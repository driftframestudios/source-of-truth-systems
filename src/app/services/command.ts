import type { WorkspaceCode } from "./workspaceTransport";
import type { ConsentStatus } from "../types";
import type { DataClass, GeographyId, ResourceId } from "../types/access";
import type { Capability, PermissionDecision } from "./permissionPolicy";

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
type RefusalBase =
  | Exclude<PermissionDecision, { ok: true }>
  | {
      readonly ok: false;
      readonly kind: "missing" | "unavailable" | "transition";
      readonly reason: string;
    };
export type FailureCode =
  | "INVALID_INPUT"
  | "MISSING_RECORD"
  | "STALE_REVISION"
  | "INVALID_TRANSITION"
  | "PERMISSION_DENIED"
  | "OWNER_UNAVAILABLE"
  | "TRANSPORT_UNCONFIRMED"
  | "WORKSPACE_EXPIRED"
  | "WORKSPACE_ABSENT"
  | "SCOPE_CHANGED"
  | "REQUEST_BUSY"
  | "WORKSPACE_QUOTA";
export interface FailureDetails {
  readonly field?: "definition" | "metadata";
  readonly nodeId?: string;
  readonly path?: ReadonlyArray<number>;
  readonly finding?:
    "name" | "limit" | "node" | "duplicate-id" | "facet-value" | "group";
}
export type CommandRefusal = RefusalBase & {
  readonly code?: FailureCode;
  readonly details?: FailureDetails;
};
const DEFAULT_CODES = {
  invalid: "INVALID_INPUT",
  missing: "MISSING_RECORD",
  unavailable: "OWNER_UNAVAILABLE",
  transition: "INVALID_TRANSITION",
  consent: "PERMISSION_DENIED",
  environment: "PERMISSION_DENIED",
  membership: "PERMISSION_DENIED",
  role: "PERMISSION_DENIED",
  clearance: "PERMISSION_DENIED",
  grant: "PERMISSION_DENIED",
} as const satisfies Record<CommandRefusal["kind"], FailureCode>;
export const failureCode = (result: CommandRefusal): FailureCode =>
  result.code ?? DEFAULT_CODES[result.kind];
export const identifyRefusal = (result: CommandRefusal): CommandRefusal => ({
  ...result,
  code: failureCode(result),
});
export type CommandResult =
  { readonly ok: true; readonly changed: boolean } | CommandRefusal;

export function commandRefusal(
  kind: CommandRefusal["kind"],
  reason: string,
  code: FailureCode = DEFAULT_CODES[kind],
  details?: FailureDetails,
): CommandRefusal {
  return { ok: false, kind, code, reason, ...(details ? { details } : {}) };
}

/** Wire codes retain API compatibility; this adapter supplies command recovery identity. */
const WORKSPACE_FAILURES = {
  LOCAL: ["unavailable", "OWNER_UNAVAILABLE"],
  ABSENT: ["unavailable", "WORKSPACE_ABSENT"],
  EXPIRED: ["unavailable", "WORKSPACE_EXPIRED"],
  DENIED: ["role", "PERMISSION_DENIED"],
  INVALID: ["invalid", "INVALID_INPUT"],
  CONFLICT: ["transition", "STALE_REVISION"],
  QUOTA: ["unavailable", "WORKSPACE_QUOTA"],
  UNAVAILABLE: ["unavailable", "TRANSPORT_UNCONFIRMED"],
  MISSING: ["missing", "MISSING_RECORD"],
} as const satisfies Record<
  Exclude<WorkspaceCode, "OK">,
  readonly [CommandRefusal["kind"], FailureCode]
>;
export function workspaceRefusal(response: {
  code: WorkspaceCode;
  message: string;
}): CommandRefusal {
  const [kind, code] =
    response.code === "OK"
      ? (["unavailable", "TRANSPORT_UNCONFIRMED"] as const)
      : WORKSPACE_FAILURES[response.code];
  return commandRefusal(kind, response.message, code);
}
