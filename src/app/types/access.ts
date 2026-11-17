// ============================================================
// Environment, identity, and access-control contract
//
// These types back the environment toggle (dev/res/stg/val/prod),
// the principal/role model, and the population-cartography access
// grid. Everything here is data-only; the mock service layer
// (accessService.ts) is the sole producer of instances.
// ============================================================

// ---- Environments -------------------------------------------

export type EnvironmentId = 'dev' | 'res' | 'stg' | 'val' | 'prod';

/** Broadest data classification a surface may render. Ordered least→most sensitive. */
export type DataClass = 'synthetic' | 'de_identified' | 'limited' | 'phi';

export const DATA_CLASS_RANK: Record<DataClass, number> = {
  synthetic: 0,
  de_identified: 1,
  limited: 2,
  phi: 3,
};

export interface InfraFootprint {
  readonly region: string;          // AWS region
  readonly account: string;         // masked account id
  readonly s3Buckets: ReadonlyArray<string>;
  readonly ec2Instances: number;
  readonly ec2Types: ReadonlyArray<string>;
  readonly batchQueues: number;
  readonly vpc: string;
  readonly kmsAlias: string;
}

export interface EnvironmentProfile {
  readonly id: EnvironmentId;
  readonly label: string;           // short, uppercase-friendly
  readonly longLabel: string;
  readonly accent: string;          // hex — drives env-tinted chrome
  readonly description: string;
  readonly dataClass: DataClass;
  readonly piiMasked: boolean;
  readonly writesEnabled: boolean;
  readonly slaTier: string;
  readonly bannerText?: string;     // shown in a strip when non-empty
  readonly infra: InfraFootprint;
}

// ---- Audience perspectives (stable legacy population IDs) ----

export type PopulationId =
  | 'everyday'
  | 'executive'
  | 'product_designer'
  | 'engineer'
  | 'researcher'
  | 'youth'
  | 'nonprofit'
  | 'biopharma'
  | 'educator'
  | 'ai_presence'
  | 'artist'
  | 'design_leader';

export interface PopulationRegister {
  readonly id: PopulationId;
  readonly label: string;
  readonly firstMove: string;       // likely first cognitive move
  readonly route: string;           // suggested architecture route
}

// ---- Roles & principals -------------------------------------

export type RoleId =
  | 'viewer'
  | 'analyst'
  | 'reviewer'
  | 'lab_operator'
  | 'arc_lead'
  | 'auditor'
  | 'admin';

export interface RoleProfile {
  readonly id: RoleId;
  readonly label: string;
  readonly summary: string;
  readonly ceiling: AccessLevel;    // highest level this role can ever hold
}

export interface Principal {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly email: string;
  readonly initials: string;
  readonly title: string;
  readonly role: RoleId;
  readonly population: PopulationId;
  readonly homeGeography: GeographyId;
  readonly clearance: DataClass;
  readonly environments: ReadonlyArray<EnvironmentId>;
  readonly lastActive: string;
}

// ---- Access grid --------------------------------------------

export type AccessLevel = 'none' | 'read' | 'write';

export const ACCESS_RANK: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
};

export type GeographyId =
  | 'us_east'
  | 'us_west'
  | 'eu_west'
  | 'eu_central'
  | 'apac'
  | 'latam';

export interface Geography {
  readonly id: GeographyId;
  readonly label: string;
  readonly code: string;            // short code for column headers
  readonly residency: string;       // data-residency regime
}

/** A resource is either a specimen view or a sequencing-data scope. */
export type ResourceKind = 'specimen' | 'sequencing';

export type ResourceId =
  // specimen views
  | 'accessioning'
  | 'wet_lab'
  | 'plate_map'
  | 'contamination'
  | 'patient_linkage'
  | 'clinical_report'
  // sequencing-data scopes
  | 'bcl'
  | 'fastq'
  | 'idat'
  | 'bam_cram'
  | 'vcf_gvcf'
  | 'qc_metrics'
  | 'run_metadata';

export interface ResourceDef {
  readonly id: ResourceId;
  readonly kind: ResourceKind;
  readonly label: string;
  readonly sensitivity: DataClass;  // minimum clearance to read at all
}

/** Sparse cell keyed by `${resource}::${geography}`. Absent = none. */
export type AccessMatrix = Record<string, AccessLevel>;

export function cellKey(resource: ResourceId, geo: GeographyId): string {
  return `${resource}::${geo}`;
}

/**
 * Effective level after applying role ceiling, environment write-lock,
 * and clearance vs. resource sensitivity. Pure — safe to memoize.
 */
export function effectiveAccess(
  requested: AccessLevel,
  role: RoleProfile,
  env: EnvironmentProfile,
  clearance: DataClass,
  resource: ResourceDef,
): AccessLevel {
  // Clearance gate: cannot even read above your clearance.
  if (DATA_CLASS_RANK[clearance] < DATA_CLASS_RANK[resource.sensitivity]) return 'none';
  // Role ceiling.
  let level = ACCESS_RANK[requested] <= ACCESS_RANK[role.ceiling] ? requested : role.ceiling;
  // Environment write-lock.
  if (!env.writesEnabled && level === 'write') level = 'read';
  return level;
}
