import type { ConsentStatus } from '../types';
import type { DataClass, GeographyId, ResourceId } from '../types/access';
import type { Capability, PermissionDecision } from './permissionPolicy';

/** Owners resolve record metadata; callers supply identifiers and intent. */
export interface CommandPermission {
  readonly action: Capability;
  readonly resource: ResourceId;
  readonly consent?: ConsentStatus;
  readonly dataClass?: DataClass;
  readonly geography?: GeographyId;
  readonly subjectId?: string;
}
export type CommandCheck = (request: CommandPermission) => PermissionDecision;
/** System/workflow examples use a capability check and their own canonical classification. */
export type WorkflowCheck = (request: {
  readonly action: Capability;
  readonly subjectId: string;
  readonly dataClass?: DataClass;
}) => PermissionDecision;
export type CommandRefusal = Exclude<PermissionDecision, { ok: true }> | {
  readonly ok: false;
  readonly kind: 'missing' | 'unavailable' | 'transition';
  readonly reason: string;
};
export type CommandResult = { readonly ok: true; readonly changed: boolean } | CommandRefusal;

export function commandRefusal(kind: CommandRefusal['kind'], reason: string): CommandRefusal {
  return { ok: false, kind, reason };
}
