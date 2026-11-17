import { useCallback } from 'react';
import { useEnvironment } from './environment';
import { useNotifications } from './notifications';
import { createError } from './errorFactory';
import { getRole } from './accessService';
import { usePermissionScenario } from './permissionScenario';
import { capabilityForRecordRole } from './permissionPolicy';
import { decidePermission, decideScopedPermission } from '../../../shared/permission-scope.mjs';
import { permissionCatalog } from './permissionScope';
import type { Capability, PermissionDecision } from './permissionPolicy';
import type { ConsentStatus } from '../types';
import type { ResourceId, RoleId, GeographyId, DataClass } from '../types/access';
import type { CommandRefusal } from './command';

/**
 * Views call `check()` to decide affordances and `deny()` to surface the
 * refusal for the current showcase scenario. Accepted command owners call the
 * same check immediately before their effect, using owner-resolved metadata.
 */
export function useWriteGate() {
  const { env, canWrite, getEnvironment } = useEnvironment();
  const { pushFromError } = useNotifications();
  const { roleId, getSelection, getScope } = usePermissionScenario();
  const role = getRole(roleId);
  const envWrites = canWrite();

  const check = useCallback(
    (opts: { action?: Capability; resource?: ResourceId; minWriteRole?: RoleId; geography?: GeographyId; consent?: ConsentStatus; dataClass?: DataClass; subjectId?: string } = {}): PermissionDecision => {
      const action = opts.action ?? capabilityForRecordRole(opts.minWriteRole);
      if (!action) return { ok: false, kind: 'invalid', reason: 'This record needs a supported permission capability.' };
      const current = getSelection();
      if (opts.resource) {
        if (!opts.geography) return { ok: false, kind: 'invalid', reason: 'This action needs a canonical resource geography.' };
        return decideScopedPermission(getScope(), { action, resource: opts.resource, geography: opts.geography, consent: opts.consent, dataClass: opts.dataClass, subjectId: opts.subjectId });
      }
      return decidePermission({ principalId: current.principal.id, role: current.roleId, environment: getEnvironment().id, action, consent: opts.consent, dataClass: opts.dataClass, subjectId: opts.subjectId }, permissionCatalog);
    },
    [getSelection, getEnvironment, getScope],
  );

  const deny = useCallback(
    (action: string, result: PermissionDecision | CommandRefusal, subjectId?: string) => {
      if (result.ok) return;
      pushFromError(createError('PERMISSION_DENIED', `${action} blocked — ${result.reason}`, { subjectId }), 'banner');
    },
    [pushFromError],
  );

  return { env, role, envWrites, check, deny };
}
