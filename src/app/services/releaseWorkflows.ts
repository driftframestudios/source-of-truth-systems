import type { ArcId, Decision, Instruction } from '../types';
import type { CommandPermission, CommandResult } from './command';
import { commandRefusal } from './command';
import type { PermissionDecision } from './permissionPolicy';

export const RELEASE_OPTIONS: ReadonlyArray<{ value: ArcId; label: string }> = [
  { value: 'arc_01', label: 'Release 01' },
  { value: 'arc_02', label: 'Release 02' },
  { value: 'arc_03', label: 'Release 03' },
  { value: 'future', label: 'Future' },
];
export type RequirementRecord = Instruction & { readonly revision: number; readonly edited: boolean; readonly replacementId?: string };
export type DecisionRecord = Decision & { readonly revision: number; readonly edited: boolean };
export interface ReleaseWorkflows {
  readonly requirements: Readonly<Record<string, RequirementRecord>>;
  readonly decisions: Readonly<Record<string, DecisionRecord>>;
}
type Identity = { readonly id: string; readonly revision: number };
export type ReleaseCommand = Identity & (
  | { readonly type: 'requirement.defer'; readonly target: ArcId }
  | { readonly type: 'requirement.supersede'; readonly replacementId: string }
  | { readonly type: 'requirement.restore' }
  | { readonly type: 'decision.confirm' }
  | { readonly type: 'decision.revisit' }
  | { readonly type: 'decision.restore' }
);
export function createReleaseWorkflows(requirements: ReadonlyArray<Instruction>, decisions: ReadonlyArray<Decision>): ReleaseWorkflows {
  return {
    requirements: Object.fromEntries(requirements.map(record => [record.id, { ...record, revision: 0, edited: false }])),
    decisions: Object.fromEntries(decisions.map(record => [record.id, { ...record, revision: 0, edited: false }])),
  };
}
function own<T>(records: Readonly<Record<string, T>>, id: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(records, id) ? records[id] : undefined;
}
const ACTIONS = new Set<ReleaseCommand['type']>([
  'requirement.defer', 'requirement.supersede', 'requirement.restore',
  'decision.confirm', 'decision.revisit', 'decision.restore',
]);

/** Release records are public planning examples; their owner gates edits, not clinical data. */
export function createReleaseCommands(owner: {
  readonly getState: () => ReleaseWorkflows;
  readonly initial: ReleaseWorkflows;
  readonly commit: (next: ReleaseWorkflows) => void;
  readonly checkPermission: (request: Pick<CommandPermission, 'action' | 'subjectId'>) => PermissionDecision;
}) {
  function prepare(command: ReleaseCommand): { ok: true; next: ReleaseWorkflows } | Exclude<CommandResult, { ok: true }> {
    if (!command || !ACTIONS.has(command.type) || typeof command.id !== 'string' || !Number.isSafeInteger(command.revision) || command.revision < 0) {
      return commandRefusal('invalid', 'Choose an available release record and action.');
    }
    const state = owner.getState();
    const requirement = command.type.startsWith('requirement.');
    const record = requirement ? own(state.requirements, command.id) : own(state.decisions, command.id);
    if (!record) return commandRefusal('missing', 'This release record is unavailable.');
    const access = owner.checkPermission({ action: 'release.manage', subjectId: record.id });
    if (!access.ok) return access;
    if (record.revision !== command.revision) return commandRefusal('transition', 'This record changed. Review its current state before applying this action.');
    const revision = record.revision + 1;
    const unavailable = () => commandRefusal('transition', 'Choose an action available for this record’s current state.');
    switch (command.type) {
      case 'requirement.defer': {
        const current = state.requirements[record.id];
        if (current.status === 'superseded' || !RELEASE_OPTIONS.some(option => option.value === command.target)) return unavailable();
        if (current.status === 'deferred' && current.arc === command.target) return unavailable();
        return { ok: true, next: { ...state, requirements: { ...state.requirements, [record.id]: { ...current, status: 'deferred', arc: command.target, revision, edited: true } } } };
      }
      case 'requirement.supersede': {
        const current = state.requirements[record.id];
        const replacement = own(state.requirements, command.replacementId);
        if (current.status === 'superseded' || !replacement || replacement.id === current.id || !['active', 'target_state'].includes(replacement.status)) return unavailable();
        return { ok: true, next: { ...state, requirements: { ...state.requirements, [record.id]: { ...current, status: 'superseded', replacementId: replacement.id, revision, edited: true } } } };
      }
      case 'requirement.restore': {
        const original = own(owner.initial.requirements, record.id);
        if (!original || !record.edited) return unavailable();
        return { ok: true, next: { ...state, requirements: { ...state.requirements, [record.id]: { ...original, revision } } } };
      }
      case 'decision.confirm':
      case 'decision.revisit': {
        const current = state.decisions[record.id];
        const status = command.type === 'decision.confirm' ? 'confirmed' : 'revisited';
        if (current.status === status || (status === 'revisited' && current.status !== 'confirmed')) return unavailable();
        return { ok: true, next: { ...state, decisions: { ...state.decisions, [record.id]: { ...current, status, revision, edited: true } } } };
      }
      case 'decision.restore': {
        const original = own(owner.initial.decisions, record.id);
        if (!original || !record.edited) return unavailable();
        return { ok: true, next: { ...state, decisions: { ...state.decisions, [record.id]: { ...original, revision } } } };
      }
    }
  }
  return {
    execute(command: ReleaseCommand): CommandResult {
      const result = prepare(command);
      if (!result.ok) return result;
      owner.commit(result.next);
      return { ok: true, changed: true };
    },
  };
}
