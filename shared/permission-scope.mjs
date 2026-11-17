/** Shared finite showcase policy. Scenario selection is public, not authentication. */
export const CAPABILITY_LABELS = Object.freeze({
  "resource.read": "Read permitted artifact locations",
  "workspace.edit": "Edit workspace examples",
  "analysis.run": "Run analysis and data recovery",
  "sample.manage": "Manage samples and laboratory work",
  "review.approve": "Review clinical results",
  "release.manage": "Coordinate release work",
  "governance.manage": "Manage governance examples",
  "policy.edit": "Edit permission scenarios",
});
export const ROLE_CAPABILITIES = Object.freeze({
  viewer: ["resource.read"],
  auditor: ["resource.read"],
  analyst: ["resource.read", "workspace.edit", "analysis.run"],
  reviewer: ["resource.read", "workspace.edit", "review.approve"],
  lab_operator: ["resource.read", "workspace.edit", "sample.manage"],
  arc_lead: [
    "resource.read",
    "workspace.edit",
    "analysis.run",
    "sample.manage",
    "review.approve",
    "release.manage",
    "governance.manage",
  ],
  admin: Object.keys(CAPABILITY_LABELS),
});
for (const capabilities of Object.values(ROLE_CAPABILITIES))
  Object.freeze(capabilities);
const CLASS_RANK = Object.freeze({
  synthetic: 0,
  de_identified: 1,
  limited: 2,
  phi: 3,
});
const ACCESS_RANK = Object.freeze({ none: 0, read: 1, write: 2 });
const CONSENT_RANK = Object.freeze({
  active: 0,
  pending: 1,
  expired: 2,
  rescinded: 3,
});
const EXPLANATION_ROLES = new Set(["reviewer", "auditor", "arc_lead", "admin"]);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const find = (values, id) => values.find((value) => value.id === id);
const deny = (kind, reason) => ({ ok: false, kind, reason });
const invalid = () =>
  deny(
    "invalid",
    "Choose a supported persona, role, action and resource for this scenario.",
  );
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, keys) =>
  record(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => own(value, key));
export const MAX_GRANT_CHANGES = 64;
export const DEFAULT_SCENARIO = Object.freeze({
  version: 1,
  principalId: "prin_self",
  roleId: "arc_lead",
  environment: "res",
  grantChanges: Object.freeze([]),
});

export function decidePermission(request, catalog) {
  if (!record(request)) return invalid();
  const principal = find(catalog.principals, request.principalId);
  const role = find(catalog.roles, request.role);
  const environment = find(catalog.environments, request.environment);
  const resource =
    request.resource === undefined
      ? undefined
      : find(catalog.resources, request.resource);
  if (
    !principal ||
    !role ||
    !environment ||
    !own(CAPABILITY_LABELS, request.action) ||
    (request.resource !== undefined && !resource) ||
    (request.consent !== undefined && !own(CONSENT_RANK, request.consent)) ||
    (request.dataClass !== undefined && !own(CLASS_RANK, request.dataClass))
  )
    return invalid();
  if (request.consent !== undefined && request.consent !== "active")
    return deny(
      "consent",
      `Analysis held while consent is ${request.consent}${request.subjectId ? ` for ${request.subjectId}` : ""} — Consent Registry overrides role permissions.`,
    );
  if (request.action !== "resource.read" && !environment.writesEnabled)
    return deny(
      "environment",
      `Write actions are disabled in the ${environment.label} scenario.`,
    );
  if (!principal.environments.includes(environment.id))
    return deny(
      "membership",
      `${principal.name} is not assigned to ${environment.label}. Choose an assigned environment or another showcase persona.`,
    );
  if (
    resource &&
    CLASS_RANK[principal.clearance] < CLASS_RANK[resource.sensitivity]
  )
    return deny(
      "clearance",
      `${resource.label} needs ${resource.sensitivity.replace("_", "-")} clearance; this persona has ${principal.clearance.replace("_", "-")}.`,
    );
  if (
    request.dataClass !== undefined &&
    CLASS_RANK[principal.clearance] < CLASS_RANK[request.dataClass]
  ) {
    return deny(
      "clearance",
      "This record is outside the selected persona’s data clearance.",
    );
  }
  if (!ROLE_CAPABILITIES[role.id].includes(request.action))
    return deny(
      "role",
      `${role.label} does not include ${CAPABILITY_LABELS[request.action].toLowerCase()}. Choose a role with that capability in Profile.`,
    );
  return { ok: true };
}
function validSelection(value, catalog) {
  return (
    exact(value, ["principalId", "roleId", "environment"]) &&
    !!find(catalog.principals, value.principalId) &&
    !!find(catalog.roles, value.roleId) &&
    !!find(catalog.environments, value.environment)
  );
}
export function deriveScenario(catalog, input = DEFAULT_SCENARIO) {
  if (
    !exact(input, [
      "version",
      "principalId",
      "roleId",
      "environment",
      "grantChanges",
    ]) ||
    input.version !== 1 ||
    !validSelection(
      {
        principalId: input.principalId,
        roleId: input.roleId,
        environment: input.environment,
      },
      catalog,
    ) ||
    !Array.isArray(input.grantChanges) ||
    input.grantChanges.length > MAX_GRANT_CHANGES
  )
    return invalid();
  const matrices = Object.fromEntries(
    catalog.principals.map((principal) => [
      principal.id,
      { ...catalog.seeds[principal.id] },
    ]),
  );
  const accepted = [];
  for (const change of input.grantChanges) {
    if (
      !exact(change, [
        "actor",
        "targetPrincipalId",
        "resource",
        "geography",
        "level",
      ]) ||
      !validSelection(change.actor, catalog) ||
      !find(catalog.principals, change.targetPrincipalId) ||
      !find(catalog.resources, change.resource) ||
      !find(catalog.geographies, change.geography) ||
      !own(ACCESS_RANK, change.level)
    )
      return invalid();
    const actor = change.actor;
    const allowed = decidePermission(
      {
        principalId: actor.principalId,
        role: actor.roleId,
        environment: actor.environment,
        action: "policy.edit",
      },
      catalog,
    );
    if (!allowed.ok) return allowed;
    const target = find(catalog.principals, change.targetPrincipalId);
    const resource = find(catalog.resources, change.resource);
    if (
      change.level !== "none" &&
      CLASS_RANK[target.clearance] < CLASS_RANK[resource.sensitivity]
    )
      return deny(
        "clearance",
        "This persona cannot receive a grant above its data clearance.",
      );
    const normalized = {
      actor: {
        principalId: actor.principalId,
        roleId: actor.roleId,
        environment: actor.environment,
      },
      targetPrincipalId: change.targetPrincipalId,
      resource: change.resource,
      geography: change.geography,
      level: change.level,
    };
    matrices[target.id][`${change.resource}::${change.geography}`] =
      change.level;
    accepted.push(
      Object.freeze({ ...normalized, actor: Object.freeze(normalized.actor) }),
    );
  }
  const selection = Object.freeze({
    principalId: input.principalId,
    roleId: input.roleId,
    environment: input.environment,
  });
  const grantChanges = Object.freeze(accepted);
  for (const matrix of Object.values(matrices)) Object.freeze(matrix);
  const key = JSON.stringify(["scope-v1", selection, grantChanges]);
  return {
    ok: true,
    scope: Object.freeze({
      selection,
      matrices: Object.freeze(matrices),
      grantChanges,
      key,
      catalog,
    }),
  };
}
export function effectiveGrant(scope, principalId, resourceId, geography) {
  const principal = find(scope.catalog.principals, principalId);
  const resource = find(scope.catalog.resources, resourceId);
  const role = find(
    scope.catalog.roles,
    principalId === scope.selection.principalId
      ? scope.selection.roleId
      : principal?.role,
  );
  const environment = find(
    scope.catalog.environments,
    scope.selection.environment,
  );
  if (
    !principal ||
    !resource ||
    !role ||
    !environment ||
    !principal.environments.includes(environment.id) ||
    CLASS_RANK[principal.clearance] < CLASS_RANK[resource.sensitivity]
  )
    return "none";
  const matrix = scope.matrices[principalId];
  const key = `${resourceId}::${geography}`;
  const requested = matrix && own(matrix, key) ? matrix[key] : "none";
  const rank = Math.min(
    ACCESS_RANK[requested] ?? 0,
    ACCESS_RANK[role.ceiling],
    environment.writesEnabled ? 2 : 1,
  );
  return ["none", "read", "write"][rank];
}
export function decideScopedPermission(scope, request) {
  if (!record(request) || !find(scope.catalog.geographies, request.geography))
    return invalid();
  const explanation =
    request.action === "resource.read" &&
    request.purpose === "explanation" &&
    EXPLANATION_ROLES.has(scope.selection.roleId);
  const decision = decidePermission(
    {
      principalId: scope.selection.principalId,
      role: scope.selection.roleId,
      environment: scope.selection.environment,
      action: request.action,
      resource: request.resource,
      consent: explanation ? undefined : request.consent,
      dataClass: request.dataClass,
      subjectId: request.subjectId,
    },
    scope.catalog,
  );
  if (!decision.ok) return decision;
  const need = request.action === "resource.read" ? 1 : 2;
  if (
    ACCESS_RANK[
      effectiveGrant(
        scope,
        scope.selection.principalId,
        request.resource,
        request.geography,
      )
    ] < need
  )
    return deny(
      "grant",
      `This scenario needs ${need === 1 ? "read" : "write"} access to ${request.resource.replaceAll("_", " ")} in ${request.geography.replaceAll("_", " ")}.`,
    );
  return { ok: true };
}
export function resolveGeography(code) {
  const codes = {
    USE: "us_east",
    USW: "us_west",
    EUW: "eu_west",
    EUC: "eu_central",
    APA: "apac",
    APAC: "apac",
    LAT: "latam",
    LATAM: "latam",
    us_east: "us_east",
    us_west: "us_west",
    eu_west: "eu_west",
    eu_central: "eu_central",
    apac: "apac",
    latam: "latam",
  };
  return typeof code === "string" && own(codes, code) ? codes[code] : undefined;
}
export function stricterConsent(...values) {
  return values
    .filter((value) => own(CONSENT_RANK, value))
    .sort((a, b) => CONSENT_RANK[b] - CONSENT_RANK[a])[0];
}
function specimenOwner(specimen, consent) {
  const geography = resolveGeography(specimen.geographyCode);
  return geography
    ? {
        geography,
        consent: stricterConsent(specimen.consent, consent),
        specimenId: specimen.id,
        dataClass: specimen.dataClass,
      }
    : undefined;
}
export function resolveWellOwner(well, ownership) {
  const id = `${String.fromCharCode(65 + well.row)}${well.col + 1}`;
  const specimen =
    ownership.specimens.find((item) => item.id === well.sampleId) ??
    ownership.specimens.find((item) => item.plateWell === id);
  if (
    typeof well.sampleId === "string" &&
    well.sampleId.startsWith("SPX-") &&
    !ownership.specimens.some((item) => item.id === well.sampleId)
  )
    return undefined;
  return specimen
    ? specimenOwner(specimen, well.consentStatus)
    : { geography: ownership.geography, consent: well.consentStatus };
}
export function resolveResultOwner(result, ownership, anchorWell) {
  const anchor = anchorWell
    ? resolveWellOwner(anchorWell, ownership)
    : undefined;
  if (anchorWell && !anchor) return undefined;
  const specimen = result.specimenId
    ? ownership.specimens.find((item) => item.id === result.specimenId)
    : anchorWell
      ? undefined
      : ownership.specimens.find((item) => item.plateWell === result.wellId);
  if (result.specimenId && !specimen) return undefined;
  if (specimen && anchor?.specimenId && specimen.id !== anchor.specimenId)
    return undefined;
  const owner = specimen
    ? specimenOwner(specimen, result.consent)
    : (anchor ?? { geography: ownership.geography, consent: result.consent });
  return owner
    ? {
        ...owner,
        consent: stricterConsent(
          owner.consent,
          anchor?.consent,
          result.consent,
        ),
      }
    : undefined;
}

const ownerDecision = (scope, owner, resource, purpose = "explanation") =>
  owner
    ? decideScopedPermission(scope, {
        action: "resource.read",
        resource,
        geography: owner.geography,
        consent: owner.consent,
        purpose,
      })
    : deny("invalid", "The record has no recognized canonical owner.");
export function canReadWell(scope, well, ownership) {
  return ownerDecision(scope, resolveWellOwner(well, ownership), "plate_map");
}
export function canReadResult(scope, result, ownership, anchorWell) {
  const owner = resolveResultOwner(result, ownership, anchorWell);
  if (
    result.status === "held" &&
    !EXPLANATION_ROLES.has(scope.selection.roleId)
  )
    return deny("consent", "This result is held for consent review.");
  return ownerDecision(scope, owner, "run_metadata");
}
const ARTIFACT_RESOURCE = Object.freeze({
  qc: "qc_metrics",
  vcf: "vcf_gvcf",
  gvcf: "vcf_gvcf",
  calls: "vcf_gvcf",
  bam: "bam_cram",
  cram: "bam_cram",
  fastq: "fastq",
  idat: "idat",
});
export function artifactResource(kind) {
  return own(ARTIFACT_RESOURCE, kind) ? ARTIFACT_RESOURCE[kind] : undefined;
}
export function canReadArtifact(
  scope,
  result,
  artifact,
  ownership,
  anchorWell,
) {
  const resource = artifactResource(artifact.kind);
  if (!resource) return invalid();
  if (result.status === "held" || artifact.legalHold)
    return deny("consent", "The artifact is held for review.");
  const owner = resolveResultOwner(result, ownership, anchorWell);
  const principal = find(scope.catalog.principals, scope.selection.principalId);
  if (
    owner?.dataClass !== undefined &&
    CLASS_RANK[principal.clearance] < CLASS_RANK[owner.dataClass]
  )
    return deny(
      "clearance",
      "The artifact belongs to a record outside this persona’s data clearance.",
    );
  return ownerDecision(scope, owner, resource, "operation");
}
export function projectResultFields(scope, result, ownership, anchorWell) {
  if (!canReadResult(scope, result, ownership, anchorWell).ok) return null;
  const owner = resolveResultOwner(result, ownership, anchorWell);
  const principal = find(scope.catalog.principals, scope.selection.principalId);
  const classified =
    owner?.dataClass === undefined ||
    CLASS_RANK[principal.clearance] >= CLASS_RANK[owner.dataClass];
  const can = (resource) =>
    classified && ownerDecision(scope, owner, resource, "operation").ok;
  const details = can("vcf_gvcf");
  const artifacts = result.artifacts.filter(
    (artifact) =>
      canReadArtifact(scope, result, artifact, ownership, anchorWell).ok,
  );
  return {
    ...result,
    consent: owner?.consent ?? result.consent,
    title: details
      ? result.title
      : `${result.kind.replaceAll("_", " ")} result`,
    label: result.label,
    reason: details ? result.reason : "Result details are outside this scope.",
    trigger: details ? result.trigger : undefined,
    seriesLabel: details ? result.seriesLabel : undefined,
    patientCode: can("patient_linkage") ? result.patientCode : undefined,
    finding: details ? result.finding : undefined,
    ctDna: details ? result.ctDna : undefined,
    metrics: can("qc_metrics") ? result.metrics : [],
    artifacts,
    artifactsRestricted:
      result.artifactsRestricted ||
      artifacts.length < result.artifacts.length ||
      undefined,
  };
}

export function projectWellFields(scope, well, ownership) {
  if (!canReadWell(scope, well, ownership).ok) return null;
  const owner = resolveWellOwner(well, ownership);
  const principal = find(scope.catalog.principals, scope.selection.principalId);
  const classified =
    owner?.dataClass === undefined ||
    CLASS_RANK[principal.clearance] >= CLASS_RANK[owner.dataClass];
  const can = (resource) =>
    classified && ownerDecision(scope, owner, resource, "operation").ok;
  return {
    ...well,
    consentStatus: owner?.consent ?? well.consentStatus,
    patientCode: can("patient_linkage") ? well.patientCode : undefined,
    contaminationProb: can("contamination")
      ? well.contaminationProb
      : undefined,
    tumorPercent: can("clinical_report") ? well.tumorPercent : undefined,
    volumeUl: can("wet_lab") ? well.volumeUl : undefined,
    concentrationNgUl: can("wet_lab") ? well.concentrationNgUl : undefined,
    dinScore: can("qc_metrics") ? well.dinScore : undefined,
    note: can("clinical_report") ? well.note : undefined,
  };
}

/** Reference IDs are rendered only when their owning result remains in scope. */
export function projectResultRelations(result, canReference) {
  return {
    ...result,
    supersedes:
      result.supersedes && canReference(result.supersedes)
        ? result.supersedes
        : undefined,
    artifacts: result.artifacts.map((artifact) => ({
      ...artifact,
      reusedFrom:
        artifact.reusedFrom && canReference(artifact.reusedFrom)
          ? artifact.reusedFrom
          : undefined,
    })),
  };
}
