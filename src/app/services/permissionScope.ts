import {
  ENVIRONMENTS,
  GEOGRAPHIES,
  PRINCIPALS,
  RESOURCES,
  ROLES,
  SEED_MATRICES,
} from "./accessService";
import type {
  PermissionCatalog,
  PermissionScope,
  ScenarioInput,
} from "../../../shared/permission-scope.mjs";

function freezeCatalog<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeCatalog(child, seen);
    Object.freeze(value);
  }
  return value;
}

/** Immutable policy vocabulary; deferred feature records stay outside this catalog. */
export const permissionCatalog: PermissionCatalog = freezeCatalog({
  principals: PRINCIPALS,
  roles: ROLES,
  environments: ENVIRONMENTS,
  resources: RESOURCES,
  geographies: GEOGRAPHIES,
  seeds: SEED_MATRICES,
});

export function scenarioInput(scope: PermissionScope): ScenarioInput {
  return { version: 1, ...scope.selection, grantChanges: scope.grantChanges };
}
