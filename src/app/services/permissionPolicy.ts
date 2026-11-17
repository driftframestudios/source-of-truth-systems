import type { RoleId } from "../types/access";
import { permissionCatalog } from "./permissionScope";
import { decidePermission as sharedDecision } from "../../../shared/permission-scope.mjs";
export {
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
} from "../../../shared/permission-scope.mjs";
export type {
  Capability,
  PermissionDenial,
  PermissionDecision,
  PermissionRequest,
} from "../../../shared/permission-scope.mjs";
import type {
  Capability,
  PermissionDecision,
  PermissionRequest,
} from "../../../shared/permission-scope.mjs";

// Compatibility for existing record-level gates. Command-specific capabilities
// replace this adapter as each accepted workflow owner is migrated.
const RECORD_CAPABILITY: Readonly<Record<RoleId, Capability>> = {
  viewer: "workspace.edit",
  analyst: "analysis.run",
  reviewer: "review.approve",
  lab_operator: "sample.manage",
  arc_lead: "release.manage",
  auditor: "governance.manage",
  admin: "policy.edit",
};
export function capabilityForRecordRole(role?: RoleId): Capability | undefined {
  return role === undefined
    ? "workspace.edit"
    : Object.prototype.hasOwnProperty.call(RECORD_CAPABILITY, role)
      ? RECORD_CAPABILITY[role]
      : undefined;
}

/** Browser adapter uses the same canonical catalog and finite policy as GraphQL. */
export function decidePermission(
  request: PermissionRequest,
): PermissionDecision {
  return sharedDecision(request, permissionCatalog);
}
