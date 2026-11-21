import type { RecordOwner } from '../../../../shared/permission-scope.mjs';
import type { ArtifactKind, ResultArtifact, RestoreTier, WellResult } from '../../types';
import type { ResourceId } from '../../types/access';
import type { CommandCheck, CommandResult } from '../../services/command';
import type { PlateTarget } from '../../services/plateHistory/records';
import { isPlateTarget } from '../../services/plateHistory/records';
import { athenaPosture, isResultHeld, resolveArtifact, type RestoreOption } from '../../services/dataAvailability';
import { applyResultRestores, ATHENA_REPAIR_DELAY_MS, overlayValue, type PlateOverlayAction, type PlateOverlayState } from './plateOverlayState';

export type PlateExampleCommand =
  | { readonly type: 'artifact.complete' | 'artifact.replay'; readonly target: PlateTarget; readonly artifactKind: ArtifactKind; readonly generation: number }
  | { readonly type: 'query.complete' | 'query.replay'; readonly target: PlateTarget; readonly generation: number };

export type PlateCommand =
  | PlateExampleCommand
  | { readonly type: 'artifact.restore'; readonly target: PlateTarget; readonly artifactKind: ArtifactKind; readonly tier: RestoreTier }
  | { readonly type: 'query.repair' | 'query.rebuild'; readonly target: PlateTarget }
  | { readonly type: 'artifact.copyUri'; readonly target: PlateTarget; readonly artifactKind: ArtifactKind };

export const ARTIFACT_RESOURCE: Readonly<Record<ArtifactKind, ResourceId>> = {
  qc: 'qc_metrics', calls: 'vcf_gvcf', vcf: 'vcf_gvcf', gvcf: 'vcf_gvcf',
  idat: 'idat', bam: 'bam_cram', cram: 'bam_cram', fastq: 'fastq',
};

type Refusal = Extract<CommandResult, { ok: false }>;
type PreparedCommand =
  | { readonly type: 'example.advance'; readonly result: WellResult; readonly action: PlateOverlayAction }
  | { readonly type: 'artifact.restore'; readonly result: WellResult; readonly artifact: ResultArtifact; readonly option: RestoreOption }
  | { readonly type: 'query.repair' | 'query.rebuild'; readonly result: WellResult }
  | { readonly type: 'artifact.copyUri'; readonly result: WellResult; readonly uri: string };

export interface PlateCommandSource {
  readonly resolve: (target: PlateTarget) => WellResult | undefined;
  readonly getState: () => PlateOverlayState;
  readonly getOwner: (result: WellResult) => RecordOwner | undefined;
  readonly check: CommandCheck;
  readonly getBucket: () => string | undefined;
}

export interface PlateCommandEffects {
  readonly now: () => string;
  readonly clock: () => number;
  readonly commit: (action: PlateOverlayAction) => boolean;
  /** Notifications follow acceptance; the state owner reconciles repair deadlines separately. */
  readonly accepted: (command: Exclude<PreparedCommand, { type: 'artifact.copyUri' }>) => void;
  readonly copy: (uri: string) => Promise<void>;
  readonly copied: (uri: string) => void;
}

const refuse = (kind: 'missing' | 'unavailable' | 'transition', reason: string): Refusal => ({ ok: false, kind, reason });

function isPlateCommand(value: unknown): value is PlateCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const command = value as Record<string, unknown>;
  if (!isPlateTarget(command.target)) return false;
  if (command.type === 'query.complete' || command.type === 'query.replay' || command.type === 'artifact.complete' || command.type === 'artifact.replay') {
    if (!Number.isSafeInteger(command.generation) || (command.generation as number) < 1) return false;
    return command.type.startsWith('query.') || (typeof command.artifactKind === 'string' && Object.prototype.hasOwnProperty.call(ARTIFACT_RESOURCE, command.artifactKind));
  }
  if (command.type === 'query.repair' || command.type === 'query.rebuild') return true;
  if (command.type !== 'artifact.restore' && command.type !== 'artifact.copyUri') return false;
  if (typeof command.artifactKind !== 'string' || !Object.prototype.hasOwnProperty.call(ARTIFACT_RESOURCE, command.artifactKind)) return false;
  return command.type === 'artifact.copyUri' || (typeof command.tier === 'string' && ['expedited', 'standard', 'bulk'].includes(command.tier));
}

/** Preview and execution resolve the same current source; a preview never grants later authority. */
function prepare(command: PlateCommand, source: PlateCommandSource, now: string): PreparedCommand | Refusal {
  if (!isPlateCommand(command)) {
    return { ok: false, kind: 'invalid', reason: 'Choose a supported Plate action.' };
  }
  const canonical = source.resolve(command.target);
  if (!canonical) return refuse('missing', 'This result is no longer in the current history. Select an available result.');
  const owner = source.getOwner(canonical);
  if (!owner) return refuse('unavailable', 'This result needs a known data owner before an action can proceed.');
  const state = source.getState();
  const result = applyResultRestores({ ...canonical, consent: owner.consent ?? canonical.consent }, state.restores);
  const subjectId = result.specimenId ?? result.id;
  if (isResultHeld(result)) return { ok: false, kind: 'consent', reason: 'This result is withheld while its consent or review hold is active.' };

  if (command.type === 'artifact.complete' || command.type === 'artifact.replay' || command.type === 'query.complete' || command.type === 'query.replay') {
    const complete = command.type === 'artifact.complete' || command.type === 'query.complete';
    let action: PlateOverlayAction;
    let resource: ResourceId;
    if (command.type === 'artifact.complete' || command.type === 'artifact.replay') {
      const artifact = result.artifacts.find(item => item.kind === command.artifactKind);
      if (!artifact) return refuse('missing', 'Select an available file for this example.');
      const task = overlayValue(state.restores, artifact.key);
      if (!task || task.generation !== command.generation || (complete && task.state !== 'in_progress')) return refuse('transition', 'Choose the current file example to continue.');
      action = complete ? { type: 'restore.complete', key: artifact.key, generation: task.generation, now }
        : { type: 'restore.replay', key: artifact.key, generation: task.generation };
      resource = ARTIFACT_RESOURCE[artifact.kind];
    } else {
      const task = overlayValue(state.athena, result.id);
      if (!task || task.generation !== command.generation || (complete && task.state !== 'running')) return refuse('transition', 'Choose the current query example to continue.');
      const posture = athenaPosture(result, task);
      if (posture.state === 'pending' || posture.state === 'restricted' || posture.state === 'excluded') return refuse('transition', 'Select a released result with query access.');
      action = { type: complete ? 'athena.complete' : 'athena.replay', resultId: result.id, generation: task.generation };
      resource = 'vcf_gvcf';
    }
    const decision = source.check({ action: 'analysis.run', resource, consent: result.consent, geography: owner.geography, dataClass: owner.dataClass, subjectId });
    return decision.ok ? { type: 'example.advance', result, action } : decision;
  }

  if (command.type === 'artifact.restore' || command.type === 'artifact.copyUri') {
    const artifact = result.artifacts.find((item) => item.kind === command.artifactKind);
    if (!artifact) return refuse('missing', 'This file is no longer part of the selected result.');
    const resolved = resolveArtifact(artifact, result);
    if (command.type === 'artifact.restore') {
      if (resolved.state !== 'archived') return refuse('transition', 'This file does not need a new restore request.');
      const option = resolved.options.find((item) => item.tier === command.tier);
      if (!option) return refuse('transition', 'Choose a restore tier available for this file.');
      const decision = source.check({ action: 'analysis.run', resource: ARTIFACT_RESOURCE[artifact.kind], consent: result.consent, geography: owner.geography, dataClass: owner.dataClass, subjectId });
      return decision.ok ? { type: command.type, result, artifact, option } : decision;
    }
    if (resolved.state === 'expired') return refuse('transition', 'This file was deleted by its lifecycle rule.');
    const decision = source.check({ action: 'resource.read', resource: ARTIFACT_RESOURCE[artifact.kind], consent: result.consent, geography: owner.geography, dataClass: owner.dataClass, subjectId });
    if (!decision.ok) return decision;
    const bucket = source.getBucket();
    return bucket ? { type: command.type, result, uri: `s3://${bucket}/${artifact.key}` }
      : refuse('unavailable', 'The selected environment has no file location to copy.');
  }

  const posture = athenaPosture(result, overlayValue(state.athena, result.id));
  const kind = command.type === 'query.repair' ? 'repair' : 'rebuild';
  if (posture.running || posture.action?.kind !== kind) return refuse('transition', 'This result does not need that query repair.');
  const decision = source.check({ action: 'analysis.run', resource: 'vcf_gvcf', consent: result.consent, geography: owner.geography, dataClass: owner.dataClass, subjectId });
  return decision.ok ? { type: command.type, result } : decision;
}

export function createPlateCommands(source: PlateCommandSource, effects: PlateCommandEffects) {
  return {
    preview(command: PlateCommand): CommandResult {
      const prepared = prepare(command, source, effects.now());
      return 'ok' in prepared ? prepared : { ok: true, changed: false };
    },
    async execute(command: PlateCommand): Promise<CommandResult> {
      const prepared = prepare(command, source, effects.now());
      if ('ok' in prepared) return prepared;
      if (prepared.type === 'artifact.copyUri') {
        try { await effects.copy(prepared.uri); }
        catch { return refuse('unavailable', 'Clipboard access is unavailable. Try copying again.'); }
        effects.copied(prepared.uri);
        return { ok: true, changed: false };
      }
      if (prepared.type === 'example.advance') return { ok: true, changed: effects.commit(prepared.action) };
      const action: PlateOverlayAction = prepared.type === 'artifact.restore'
        ? { type: 'restore.request', artifact: prepared.artifact, option: prepared.option, now: effects.now() }
        : prepared.type === 'query.repair'
          ? { type: 'athena.start', resultId: prepared.result.id, kind: 'repair', completion: { at: effects.clock() + ATHENA_REPAIR_DELAY_MS, wellId: prepared.result.wellId, label: prepared.result.label, runDate: prepared.result.runDate } }
          : { type: 'athena.start', resultId: prepared.result.id, kind: 'rebuild' };
      const changed = effects.commit(action);
      if (changed) effects.accepted(prepared);
      return { ok: true, changed };
    },
  };
}
