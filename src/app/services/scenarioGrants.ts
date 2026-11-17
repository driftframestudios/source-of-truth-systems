import type { AccessMatrix } from "../types/access";
import { cellKey } from "../types/access";
import {
  MAX_GRANT_CHANGES,
  decidePermission,
  deriveScenario,
} from "../../../shared/permission-scope.mjs";
import type {
  GrantChange,
  PermissionScope,
  PermissionDecision,
} from "../../../shared/permission-scope.mjs";

type GrantSave =
  | { readonly ok: true; readonly scope: PermissionScope }
  | Exclude<PermissionDecision, { ok: true }>;

/** Validate a complete draft against the current actor, then replay its finite changes. */
export function prepareGrantSave(
  scope: PermissionScope,
  targetPrincipalId: string,
  matrix: unknown,
): GrantSave {
  const { catalog, selection: actor } = scope;
  const permission = decidePermission(
    {
      principalId: actor.principalId,
      role: actor.roleId,
      environment: actor.environment,
      action: "policy.edit",
    },
    catalog,
  );
  if (!permission.ok) return permission;
  const validCells = new Set(
    catalog.resources.flatMap((resource) =>
      catalog.geographies.map((geography) =>
        cellKey(resource.id, geography.id),
      ),
    ),
  );
  if (
    !catalog.principals.some(
      (principal) => principal.id === targetPrincipalId,
    ) ||
    !matrix ||
    typeof matrix !== "object" ||
    Array.isArray(matrix) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(matrix)) ||
    Object.entries(matrix).some(
      ([key, level]) =>
        !validCells.has(key) || !["none", "read", "write"].includes(level),
    )
  ) {
    return {
      ok: false,
      kind: "invalid",
      reason: "Choose a known person and supported resource grants.",
    };
  }
  const current = scope.matrices[targetPrincipalId];
  const draft = matrix as AccessMatrix;
  const changes: GrantChange[] = [];
  for (const resource of catalog.resources)
    for (const geography of catalog.geographies) {
      const key = cellKey(resource.id, geography.id);
      const level = Object.prototype.hasOwnProperty.call(draft, key)
        ? draft[key]
        : "none";
      if (level !== (current[key] ?? "none"))
        changes.push({
          actor,
          targetPrincipalId,
          resource: resource.id,
          geography: geography.id,
          level,
        });
    }
  if (!changes.length) return { ok: true, scope };
  if (scope.grantChanges.length + changes.length > MAX_GRANT_CHANGES) {
    return {
      ok: false,
      kind: "invalid",
      reason: `This experiment allows ${MAX_GRANT_CHANGES} saved cell changes. Use Reset scenario grants to start another; accepted work stays in place.`,
    };
  }
  return deriveScenario(catalog, {
    version: 1,
    ...actor,
    grantChanges: [...scope.grantChanges, ...changes],
  });
}

/** Recover the public example experiment while retaining its current actor and ceilings. */
export function resetScenarioGrants(scope: PermissionScope): PermissionScope {
  if (!scope.grantChanges.length) return scope;
  const reset = deriveScenario(scope.catalog, {
    version: 1,
    ...scope.selection,
    grantChanges: [],
  });
  if (!reset.ok) throw new Error("Accepted permission scenario is invalid.");
  return reset.scope;
}
