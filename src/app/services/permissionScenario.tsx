import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { PRINCIPALS, POPULATIONS, ROLES } from './accessService';
import type { AccessMatrix, PopulationId, Principal, RoleId } from '../types/access';
import { useEnvironment } from './environment';
import { permissionCatalog } from './permissionScope';
import { deriveScenario } from '../../../shared/permission-scope.mjs';
import { prepareGrantSave, resetScenarioGrants } from './scenarioGrants';
import type { GrantChange, PermissionScope, PermissionDecision } from '../../../shared/permission-scope.mjs';

interface ScenarioSelection {
  readonly principal: Principal;
  readonly roleId: RoleId;
  readonly audienceId: PopulationId;
}
interface PermissionScenario extends ScenarioSelection {
  getSelection: () => ScenarioSelection;
  scope: PermissionScope;
  getScope: () => PermissionScope;
  saveGrants: (targetPrincipalId: string, matrix: Readonly<AccessMatrix>) => PermissionDecision;
  resetGrants: () => void;
  selectPersona: (id: string) => void;
  selectRole: (id: RoleId) => void;
  selectAudience: (id: PopulationId) => void;
}
const ScenarioContext = createContext<PermissionScenario | null>(null);
const DEFAULT_PERSONA = PRINCIPALS[0];

/** Browser choices describe a public scenario; they never establish a verified identity. */
export function PermissionScenarioProvider({ children }: { children: ReactNode }) {
  const { env, getEnvironment } = useEnvironment();
  const [selection, setSelection] = useState({ principal: DEFAULT_PERSONA, roleId: DEFAULT_PERSONA.role, audienceId: DEFAULT_PERSONA.population });
  const accepted = useRef(selection);
  const [grantChanges, setGrantChanges] = useState<readonly GrantChange[]>([]);
  const acceptedChanges = useRef(grantChanges);
  const cached = useRef<{ selection: ScenarioSelection; changes: readonly GrantChange[]; environment: string; scope: PermissionScope } | null>(null);
  const getSelection = useCallback(() => accepted.current, []);
  const getScope = useCallback(() => {
    const current = accepted.current;
    const environment = getEnvironment().id;
    const changes = acceptedChanges.current;
    const previous = cached.current;
    if (previous?.selection === current && previous.changes === changes && previous.environment === environment) return previous.scope;
    const derived = deriveScenario(permissionCatalog, { version: 1, principalId: current.principal.id, roleId: current.roleId, environment, grantChanges: changes });
    if (!derived.ok) throw new Error('Accepted permission scenario is invalid.');
    cached.current = { selection: current, changes, environment, scope: derived.scope };
    return derived.scope;
  }, [getEnvironment]);
  const update = useCallback((next: ScenarioSelection) => {
    accepted.current = next;
    setSelection(next);
  }, []);
  const selectPersona = useCallback((id: string) => {
    const principal = PRINCIPALS.find((item) => item.id === id);
    if (principal) update({ principal, roleId: principal.role, audienceId: principal.population });
  }, [update]);
  const selectRole = useCallback((roleId: RoleId) => {
    if (ROLES.some((item) => item.id === roleId)) update({ ...accepted.current, roleId });
  }, [update]);
  const selectAudience = useCallback((audienceId: PopulationId) => {
    if (POPULATIONS.some((item) => item.id === audienceId)) update({ ...accepted.current, audienceId });
  }, [update]);
  const saveGrants = useCallback((targetPrincipalId: string, matrix: Readonly<AccessMatrix>): PermissionDecision => {
    const result = prepareGrantSave(getScope(), targetPrincipalId, matrix);
    if (!result.ok) return result;
    acceptedChanges.current = result.scope.grantChanges;
    setGrantChanges(result.scope.grantChanges);
    return { ok: true };
  }, [getScope]);
  const resetGrants = useCallback(() => {
    const reset = resetScenarioGrants(getScope());
    acceptedChanges.current = reset.grantChanges;
    setGrantChanges(reset.grantChanges);
  }, [getScope]);
  const scope = useMemo(() => getScope(), [selection, grantChanges, env.id, getScope]);
  const value = useMemo(() => ({ ...selection, scope, getSelection, getScope, saveGrants, resetGrants, selectPersona, selectRole, selectAudience }), [selection, scope, getSelection, getScope, saveGrants, resetGrants, selectPersona, selectRole, selectAudience]);
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function usePermissionScenario(): PermissionScenario {
  const value = useContext(ScenarioContext);
  if (!value) throw new Error('Permission scenarios need the root PermissionScenarioProvider.');
  return value;
}

export function usePermissionScope() {
  const { scope, getScope } = usePermissionScenario();
  return { scope, key: scope.key, getScope };
}
