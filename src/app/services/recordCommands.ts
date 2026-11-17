import { resolveGeography } from '../../../shared/permission-scope.mjs';
import type { CommandCheck, CommandPermission, CommandRefusal, CommandResult } from './command';
import { commandRefusal } from './command';
import { recordSessionReducer } from './recordSession';
import type { RecordSessionAction, RecordSessionState } from './recordSession';

const CONTRACTS = {
  'specimen.sample': { action: 'sample.manage', resource: 'wet_lab' },
  'specimen.order': { action: 'sample.manage', resource: 'accessioning' },
  'specimen.review': { action: 'review.approve', resource: 'clinical_report' },
  'biomarker.review': { action: 'review.approve', resource: 'clinical_report' },
} as const satisfies Record<RecordSessionAction['type'], Pick<CommandPermission, 'action' | 'resource'>>;

function hasOwn<T>(records: Readonly<Record<string, T>>, id: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(records, id) ? records[id] : undefined;
}

/** A preview is a reading, never a ticket authorizing a later edit. */
export function createRecordCommands(owner: {
  readonly getState: () => RecordSessionState;
  readonly commit: (state: RecordSessionState) => void;
  readonly checkPermission: CommandCheck;
}) {
  function prepare(command: RecordSessionAction): { ok: true; next: RecordSessionState } | CommandRefusal {
    if (!command || typeof command.id !== 'string' || typeof command.event !== 'string' || !Object.prototype.hasOwnProperty.call(CONTRACTS, command.type)) {
      return commandRefusal('invalid', 'Choose a supported record and workflow action.');
    }
    const contract = CONTRACTS[command.type];
    const state = owner.getState();
    const marker = command.type === 'biomarker.review' ? hasOwn(state.biomarkers.byId, command.id) : undefined;
    if (command.type === 'biomarker.review' && !marker) return commandRefusal('missing', 'This biomarker is no longer available.');
    const specimen = hasOwn(state.specimens.byId, marker?.specimenId ?? command.id);
    if (!specimen) return commandRefusal('missing', 'This workflow needs an available specimen and its consent record.');
    const geography = resolveGeography(specimen.geographyCode);
    if (!geography) return commandRefusal('unavailable', 'This specimen needs a known data geography before its workflow can change.');
    // Workflow commands use their resource contract; clinical approval requires clinical-report clearance.
    const access = owner.checkPermission({ action: contract.action, resource: contract.resource, consent: specimen.consent, geography, subjectId: specimen.id });
    if (!access.ok) return access;
    const next = recordSessionReducer(state, command);
    if (next === state) return commandRefusal('transition', 'This action has already finished or the workflow has moved on.');
    return { ok: true, next };
  }
  return {
    check(command: RecordSessionAction): CommandResult {
      const result = prepare(command);
      return result.ok ? { ok: true, changed: true } : result;
    },
    execute(command: RecordSessionAction): CommandResult {
      const result = prepare(command);
      if (!result.ok) return result;
      owner.commit(result.next);
      return { ok: true, changed: true };
    },
  };
}
