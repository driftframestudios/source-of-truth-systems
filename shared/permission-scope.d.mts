import type {
  ConsentStatus,
  Well,
  WellResult,
  ResultArtifact,
} from "../src/app/types/index";
import type {
  AccessLevel,
  AccessMatrix,
  EnvironmentId,
  EnvironmentProfile,
  Geography,
  GeographyId,
  Principal,
  ResourceDef,
  ResourceId,
  RoleId,
  RoleProfile,
  DataClass,
} from "../src/app/types/access";
export type Capability =
  | "resource.read"
  | "workspace.edit"
  | "analysis.run"
  | "sample.manage"
  | "review.approve"
  | "release.manage"
  | "governance.manage"
  | "policy.edit";
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>>;
export const ROLE_CAPABILITIES: Readonly<Record<RoleId, readonly Capability[]>>;
export type PermissionDenial =
  | "invalid"
  | "consent"
  | "environment"
  | "membership"
  | "role"
  | "clearance"
  | "grant";
export type PermissionDecision =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly kind: PermissionDenial;
      readonly reason: string;
    };
export interface PermissionCatalog {
  readonly principals: readonly Principal[];
  readonly roles: readonly RoleProfile[];
  readonly environments: readonly EnvironmentProfile[];
  readonly resources: readonly ResourceDef[];
  readonly geographies: readonly Geography[];
  readonly seeds: Readonly<Record<string, Readonly<AccessMatrix>>>;
}
export interface ScenarioSelection {
  readonly principalId: string;
  readonly roleId: RoleId;
  readonly environment: EnvironmentId;
}
export interface GrantChange {
  readonly actor: ScenarioSelection;
  readonly targetPrincipalId: string;
  readonly resource: ResourceId;
  readonly geography: GeographyId;
  readonly level: AccessLevel;
}
export interface ScenarioInput extends ScenarioSelection {
  readonly version: 1;
  readonly grantChanges: readonly GrantChange[];
}
export interface PermissionScope {
  readonly selection: ScenarioSelection;
  readonly matrices: Readonly<Record<string, Readonly<AccessMatrix>>>;
  readonly grantChanges: readonly GrantChange[];
  readonly key: string;
  readonly catalog: PermissionCatalog;
}
export interface PermissionRequest {
  readonly principalId: string;
  readonly role: RoleId;
  readonly environment: EnvironmentId;
  readonly action: Capability;
  readonly resource?: ResourceId;
  readonly consent?: ConsentStatus;
  readonly dataClass?: DataClass;
  readonly subjectId?: string;
}
export interface ScopedPermissionRequest {
  readonly action: Capability;
  readonly resource: ResourceId;
  readonly geography: GeographyId;
  readonly consent?: ConsentStatus;
  readonly dataClass?: DataClass;
  readonly subjectId?: string;
  readonly purpose?: "operation" | "explanation";
}
export interface OwnershipSpecimen {
  readonly id: string;
  readonly plateWell?: string;
  readonly geographyCode: string;
  readonly consent: ConsentStatus;
  readonly dataClass: DataClass;
}
export interface RecordOwnership {
  readonly plateId: string;
  readonly geography: GeographyId;
  readonly specimens: readonly OwnershipSpecimen[];
}
export interface RecordOwner {
  readonly geography: GeographyId;
  readonly consent?: ConsentStatus;
  readonly specimenId?: string;
  readonly dataClass?: DataClass;
}
export const DEFAULT_SCENARIO: ScenarioInput;
export const MAX_GRANT_CHANGES: number;
export function deriveScenario(
  catalog: PermissionCatalog,
  input?: unknown,
):
  | { readonly ok: true; readonly scope: PermissionScope }
  | Exclude<PermissionDecision, { ok: true }>;
export function decidePermission(
  request: PermissionRequest,
  catalog: PermissionCatalog,
): PermissionDecision;
export function decideScopedPermission(
  scope: PermissionScope,
  request: ScopedPermissionRequest,
): PermissionDecision;
export function effectiveGrant(
  scope: PermissionScope,
  principalId: string,
  resource: ResourceId,
  geography: GeographyId,
): AccessLevel;
export function resolveWellOwner(
  well: Pick<Well, "row" | "col" | "sampleId" | "consentStatus">,
  ownership: RecordOwnership,
): RecordOwner | undefined;
export function resolveResultOwner(
  result: Pick<WellResult, "wellId" | "specimenId" | "consent">,
  ownership: RecordOwnership,
  anchorWell?: Well,
): RecordOwner | undefined;
export function canReadWell(
  scope: PermissionScope,
  well: Pick<Well, "row" | "col" | "sampleId" | "consentStatus">,
  ownership: RecordOwnership,
): PermissionDecision;
export function canReadResult(
  scope: PermissionScope,
  result: WellResult,
  ownership: RecordOwnership,
  anchorWell?: Well,
): PermissionDecision;
export function canReadArtifact(
  scope: PermissionScope,
  result: WellResult,
  artifact: Pick<ResultArtifact, "kind" | "legalHold">,
  ownership: RecordOwnership,
  anchorWell?: Well,
): PermissionDecision;
export function artifactResource(kind: string): ResourceId | undefined;
export function stricterConsent(
  ...values: readonly (ConsentStatus | undefined)[]
): ConsentStatus | undefined;

export function resolveGeography(code: string): GeographyId | undefined;
export function projectResultFields(
  scope: PermissionScope,
  result: WellResult,
  ownership: RecordOwnership,
  anchorWell?: Well,
): WellResult | null;

export function projectWellFields(
  scope: PermissionScope,
  well: Well,
  ownership: RecordOwnership,
): Well | null;

export function projectResultRelations(
  result: WellResult,
  canReference: (resultId: string) => boolean,
): WellResult;
