// ============================================================
// Mock access-control + infrastructure service.
//
// Simulates a backend behind the environment toggle: environment
// profiles (each with its own AWS footprint), roles, principals,
// the resource catalog, and canonical per-principal grant seeds.
// PermissionScenarioProvider owns accepted browser-session grants;
// the shared policy kernel validates each change.
// ============================================================

import type { ConsentStatus } from '../types';
import type {
  EnvironmentId, EnvironmentProfile,
  RoleId, RoleProfile,
  Principal,
  Geography, GeographyId,
  ResourceDef, ResourceId,
  AccessMatrix, AccessLevel,
  PopulationId, PopulationRegister,
} from '../types/access';
import { cellKey } from '../types/access';

// ---- latency simulation -------------------------------------

function delay<T>(value: T, ms = 180): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ---- environments -------------------------------------------

export const ENVIRONMENTS: ReadonlyArray<EnvironmentProfile> = [
  {
    id: 'dev',
    label: 'DEV',
    longLabel: 'Development',
    accent: '#38bdf8',
    description: 'Development scenario with synthetic fixtures and local editing.',
    dataClass: 'synthetic',
    piiMasked: true,
    writesEnabled: true,
    slaTier: 'best-effort',
    infra: {
      region: 'us-east-1',
      account: '1042••••3317',
      s3Buckets: ['sotc-dev-artifacts', 'sotc-dev-streams', 'sotc-dev-scratch'],
      ec2Instances: 6,
      ec2Types: ['t3.large', 'c6i.2xlarge'],
      batchQueues: 1,
      vpc: 'vpc-dev-0a41',
      kmsAlias: 'alias/sotc-dev',
    },
  },
  {
    id: 'res',
    label: 'RES',
    longLabel: 'Research',
    accent: '#a78bfa',
    description: 'Research scenario with de-identified cohort examples and exploratory pipelines.',
    dataClass: 'de_identified',
    piiMasked: true,
    writesEnabled: true,
    slaTier: 'standard',
    bannerText: 'Research scenario — de-identified cohort examples. Re-identification is prohibited.',
    infra: {
      region: 'us-west-2',
      account: '2278••••9041',
      s3Buckets: ['sotc-res-cohorts', 'sotc-res-artifacts', 'sotc-res-streams', 'sotc-res-lineage'],
      ec2Instances: 24,
      ec2Types: ['r6i.4xlarge', 'c6i.8xlarge', 'g5.xlarge'],
      batchQueues: 3,
      vpc: 'vpc-res-1b93',
      kmsAlias: 'alias/sotc-res',
    },
  },
  {
    id: 'stg',
    label: 'STG',
    longLabel: 'Staging',
    accent: '#34d399',
    description: 'Staging scenario with limited-data examples and release-candidate pipelines. Local edits are enabled.',
    dataClass: 'limited',
    piiMasked: true,
    writesEnabled: true,
    slaTier: 'production-mirror',
    bannerText: 'Staging scenario — local edits enabled. Reviewer co-signing is not simulated.',
    infra: {
      region: 'us-east-1',
      account: '3391••••5502',
      s3Buckets: ['sotc-stg-artifacts', 'sotc-stg-streams', 'sotc-stg-lineage', 'sotc-stg-reports'],
      ec2Instances: 18,
      ec2Types: ['c6i.4xlarge', 'r6i.2xlarge'],
      batchQueues: 2,
      vpc: 'vpc-stg-2c14',
      kmsAlias: 'alias/sotc-stg',
    },
  },
  {
    id: 'val',
    label: 'VAL',
    longLabel: 'Validation',
    accent: '#f59e0b',
    description: 'Validation scenario with controlled-data examples and locked write actions.',
    dataClass: 'limited',
    piiMasked: true,
    writesEnabled: false,
    slaTier: 'validated',
    bannerText: 'Validation scenario — write actions are disabled. Example records remain available to explore.',
    infra: {
      region: 'us-east-2',
      account: '4417••••8823',
      s3Buckets: ['sotc-val-controlled', 'sotc-val-artifacts', 'sotc-val-audit', 'sotc-val-reports'],
      ec2Instances: 12,
      ec2Types: ['c6i.4xlarge', 'm6i.2xlarge'],
      batchQueues: 2,
      vpc: 'vpc-val-3d77',
      kmsAlias: 'alias/sotc-val',
    },
  },
  {
    id: 'prod',
    label: 'PROD',
    longLabel: 'Production',
    accent: '#fb7185',
    description: 'Production scenario with synthetic clinical records and locked write actions.',
    dataClass: 'phi',
    piiMasked: false,
    writesEnabled: false,
    slaTier: 'clinical-24x7',
    bannerText: 'Production scenario — synthetic clinical records; write actions are disabled.',
    infra: {
      region: 'us-east-1',
      account: '5590••••1174',
      s3Buckets: ['sotc-prod-clinical', 'sotc-prod-artifacts', 'sotc-prod-streams', 'sotc-prod-audit', 'sotc-prod-reports', 'sotc-prod-lineage'],
      ec2Instances: 42,
      ec2Types: ['c6i.8xlarge', 'r6i.8xlarge', 'g5.2xlarge'],
      batchQueues: 5,
      vpc: 'vpc-prod-4e21',
      kmsAlias: 'alias/sotc-prod-cmk',
    },
  },
];

export function getEnvironment(id: EnvironmentId): EnvironmentProfile {
  const env = ENVIRONMENTS.find((e) => e.id === id);
  if (!env) throw new Error(`Unknown environment: ${id}`);
  return env;
}

// ---- populations --------------------------------------------

export const POPULATIONS: ReadonlyArray<PopulationRegister> = [
  { id: 'everyday', label: 'Lab orientation', firstMove: 'Follow a sample from intake to report', route: 'Lanes → Specimens' },
  { id: 'executive', label: 'Program leadership', firstMove: 'Compare delivery readiness and unresolved risks', route: 'Release plan → Decisions' },
  { id: 'product_designer', label: 'Clinical workflow design', firstMove: 'Inspect handoffs between laboratory and review teams', route: 'Lanes → Requirements' },
  { id: 'engineer', label: 'Bioinformatics engineering', firstMove: 'Trace pipeline inputs and data recovery', route: 'Lanes → Sources' },
  { id: 'researcher', label: 'Translational research', firstMove: 'Compare cohorts and follow result evidence', route: 'Cohort Builder → Biomarkers' },
  { id: 'youth', label: 'Laboratory onboarding', firstMove: 'Explore a plate and its sample histories', route: 'Lanes → Plate' },
  { id: 'nonprofit', label: 'Patient advocacy', firstMove: 'Understand consent and the reason for a rerun', route: 'Specimens → Plate' },
  { id: 'biopharma', label: 'Clinical interpretation', firstMove: 'Review variant evidence and reporting status', route: 'Biomarkers → Specimens' },
  { id: 'educator', label: 'Laboratory training', firstMove: 'Connect quality checks to sample progression', route: 'Quality Control → Lanes' },
  { id: 'ai_presence', label: 'Pipeline automation', firstMove: 'Inspect data contracts and recovery boundaries', route: 'Requirements → Sources' },
  { id: 'artist', label: 'Scientific communication', firstMove: 'Build a clear account of the supporting evidence', route: 'Presentations → Artifacts' },
  { id: 'design_leader', label: 'Platform delivery', firstMove: 'Connect team decisions to release readiness', route: 'Release plan → Map' },
];

export function getPopulation(id: PopulationId): PopulationRegister {
  return POPULATIONS.find((p) => p.id === id) ?? POPULATIONS[0];
}

// ---- roles --------------------------------------------------

export const ROLES: ReadonlyArray<RoleProfile> = [
  {
    id: 'viewer',
    label: 'Viewer',
    summary: 'Read-only orientation across permitted geographies. No mutations anywhere.',
    ceiling: 'read',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    summary: 'Explores cohorts and streams, annotates artifacts, proposes comparisons.',
    ceiling: 'write',
  },
  {
    id: 'reviewer',
    label: 'Clinical Reviewer',
    summary: 'Reviews variant calls and clinical reports in the current scenario.',
    ceiling: 'write',
  },
  {
    id: 'lab_operator',
    label: 'Lab Operator',
    summary: 'Accessions specimens, manages plate maps, records wet-lab QC.',
    ceiling: 'write',
  },
  {
    id: 'arc_lead',
    label: 'Release Lead',
    summary: 'Coordinates the active release: maintains requirements, resolves conflicts, and reviews the delivery plan.',
    ceiling: 'write',
  },
  {
    id: 'auditor',
    label: 'Auditor',
    summary: 'Read-only across all geographies including audit trails; cannot mutate.',
    ceiling: 'read',
  },
  {
    id: 'admin',
    label: 'Administrator',
    summary: 'Manages principals, roles, and access grids. Full write ceiling.',
    ceiling: 'write',
  },
];

export function getRole(id: RoleId): RoleProfile {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

// ---- geographies --------------------------------------------

export const GEOGRAPHIES: ReadonlyArray<Geography> = [
  { id: 'us_east',    label: 'US East',       code: 'USE', residency: 'US · HIPAA' },
  { id: 'us_west',    label: 'US West',       code: 'USW', residency: 'US · HIPAA' },
  { id: 'eu_west',    label: 'EU West',       code: 'EUW', residency: 'EU · GDPR' },
  { id: 'eu_central', label: 'EU Central',    code: 'EUC', residency: 'EU · GDPR' },
  { id: 'apac',       label: 'APAC',          code: 'APA', residency: 'APAC · local' },
  { id: 'latam',      label: 'LATAM',         code: 'LAT', residency: 'BR · LGPD' },
];

// ---- resource catalog ---------------------------------------

export const RESOURCES: ReadonlyArray<ResourceDef> = [
  { id: 'accessioning',    kind: 'specimen',   label: 'Accessioning',      sensitivity: 'de_identified' },
  { id: 'wet_lab',         kind: 'specimen',   label: 'Wet-Lab QC',        sensitivity: 'de_identified' },
  { id: 'plate_map',       kind: 'specimen',   label: 'Plate Map',         sensitivity: 'de_identified' },
  { id: 'contamination',   kind: 'specimen',   label: 'Contamination',     sensitivity: 'limited' },
  { id: 'patient_linkage', kind: 'specimen',   label: 'Patient Linkage',   sensitivity: 'phi' },
  { id: 'clinical_report', kind: 'specimen',   label: 'Clinical Report',   sensitivity: 'phi' },
  { id: 'bcl',             kind: 'sequencing', label: 'BCL',               sensitivity: 'synthetic' },
  { id: 'fastq',           kind: 'sequencing', label: 'FASTQ',             sensitivity: 'de_identified' },
  { id: 'idat',            kind: 'sequencing', label: 'IDAT',              sensitivity: 'limited' },
  { id: 'bam_cram',        kind: 'sequencing', label: 'BAM / CRAM',        sensitivity: 'limited' },
  { id: 'vcf_gvcf',        kind: 'sequencing', label: 'VCF / gVCF',        sensitivity: 'limited' },
  { id: 'qc_metrics',      kind: 'sequencing', label: 'QC Metrics',        sensitivity: 'de_identified' },
  { id: 'run_metadata',    kind: 'sequencing', label: 'Run Metadata',      sensitivity: 'synthetic' },
];

// ---- principals ---------------------------------------------

export const PRINCIPALS: ReadonlyArray<Principal> = [
  {
    id: 'prin_self', name: 'Platform Lead', handle: 'platform-lead', email: 'platform-lead@genomics.example',
    initials: 'RM', title: 'Release Lead · Genomics Platform', role: 'arc_lead', population: 'design_leader',
    homeGeography: 'us_east', clearance: 'limited', environments: ['dev', 'res', 'stg', 'val'], lastActive: 'now',
  },
  {
    id: 'prin_okafor', name: 'Dr. A. Okafor', handle: 'aokafor', email: 'aokafor@genomics.example',
    initials: 'AO', title: 'Clinical Reviewer', role: 'reviewer', population: 'biopharma',
    homeGeography: 'eu_west', clearance: 'phi', environments: ['stg', 'val', 'prod'], lastActive: '4m ago',
  },
  {
    id: 'prin_lindqvist', name: 'M. Lindqvist', handle: 'mlindqvist', email: 'mlindqvist@genomics.example',
    initials: 'ML', title: 'Lab Operator', role: 'lab_operator', population: 'researcher',
    homeGeography: 'eu_central', clearance: 'limited', environments: ['res', 'stg', 'val'], lastActive: '22m ago',
  },
  {
    id: 'prin_tanaka', name: 'K. Tanaka', handle: 'ktanaka', email: 'ktanaka@genomics.example',
    initials: 'KT', title: 'Bioinformatics Analyst', role: 'analyst', population: 'engineer',
    homeGeography: 'apac', clearance: 'de_identified', environments: ['dev', 'res', 'stg'], lastActive: '1h ago',
  },
  {
    id: 'prin_reyes', name: 'C. Reyes', handle: 'creyes', email: 'creyes@genomics.example',
    initials: 'CR', title: 'Compliance Auditor', role: 'auditor', population: 'executive',
    homeGeography: 'latam', clearance: 'phi', environments: ['val', 'prod'], lastActive: '3h ago',
  },
];

// ---- access matrices ----------------------------------------
// Canonical scenario seeds. Accepted edits belong to the application session.

function buildMatrix(spec: Partial<Record<ResourceId, Partial<Record<GeographyId, AccessLevel>>>>): AccessMatrix {
  const m: AccessMatrix = {};
  for (const res of RESOURCES) {
    const geoSpec = spec[res.id] ?? {};
    for (const geo of GEOGRAPHIES) {
      const level = geoSpec[geo.id] ?? 'none';
      if (level !== 'none') m[cellKey(res.id, geo.id)] = level;
    }
  }
  return m;
}

const ALL_GEO: Record<GeographyId, AccessLevel> = {
  us_east: 'read', us_west: 'read', eu_west: 'read', eu_central: 'read', apac: 'read', latam: 'read',
};

export const SEED_MATRICES: Readonly<Record<string, Readonly<AccessMatrix>>> = {
  // The default showcase keeps its existing non-clinical examples readable.
  prin_self: buildMatrix({
    ...Object.fromEntries(RESOURCES.filter((resource) => resource.sensitivity !== 'phi').map((resource) => [resource.id, ALL_GEO])),
    accessioning: { ...ALL_GEO, us_east: 'write', us_west: 'write', apac: 'write' },
    wet_lab: { ...ALL_GEO, us_east: 'write' },
    plate_map: { ...ALL_GEO, us_east: 'write', us_west: 'write' },
    contamination: { ...ALL_GEO, us_east: 'write' },
    bcl: ALL_GEO, fastq: ALL_GEO, bam_cram: { ...ALL_GEO, us_east: 'write' },
    vcf_gvcf: { ...ALL_GEO, eu_west: 'write' }, idat: ALL_GEO, qc_metrics: ALL_GEO, run_metadata: ALL_GEO,
  }),
  prin_okafor: buildMatrix({
    plate_map: { eu_west: 'read' }, run_metadata: { eu_west: 'read' },
    contamination: { eu_west: 'write', eu_central: 'read' },
    patient_linkage: { eu_west: 'read' },
    clinical_report: { us_east: 'write', eu_west: 'write', eu_central: 'read' },
    vcf_gvcf: { eu_west: 'write', eu_central: 'read' }, bam_cram: { eu_west: 'read' },
    qc_metrics: { eu_west: 'read', eu_central: 'read' },
  }),
  prin_lindqvist: buildMatrix({
    accessioning: { eu_central: 'write', eu_west: 'write' },
    wet_lab: { eu_central: 'write', eu_west: 'write' },
    plate_map: { eu_central: 'write' },
    contamination: { eu_central: 'write' },
    bcl: { eu_central: 'read' }, qc_metrics: { eu_central: 'read', eu_west: 'read' }, run_metadata: { eu_central: 'read' },
  }),
  prin_tanaka: buildMatrix({
    plate_map: { apac: 'read' }, contamination: { apac: 'read' },
    fastq: { apac: 'write', us_west: 'read' }, bam_cram: { apac: 'write' },
    vcf_gvcf: { apac: 'read' }, qc_metrics: { apac: 'write', us_west: 'read' }, run_metadata: { apac: 'read' },
  }),
  prin_reyes: buildMatrix({
    accessioning: ALL_GEO, wet_lab: ALL_GEO, plate_map: ALL_GEO, contamination: ALL_GEO,
    patient_linkage: ALL_GEO, clinical_report: ALL_GEO,
    bcl: ALL_GEO, fastq: ALL_GEO, idat: ALL_GEO, bam_cram: ALL_GEO, vcf_gvcf: ALL_GEO, qc_metrics: ALL_GEO, run_metadata: ALL_GEO,
  }),
};

// ---- async API ----------------------------------------------

export function listPrincipals(): Promise<ReadonlyArray<Principal>> {
  return delay(PRINCIPALS);
}

export function getPrincipal(id: string): Promise<Principal | undefined> {
  return delay(PRINCIPALS.find((p) => p.id === id));
}

export function countGrants(matrix: AccessMatrix): { read: number; write: number } {
  let read = 0;
  let write = 0;
  for (const level of Object.values(matrix)) {
    if (level === 'read') read += 1;
    else if (level === 'write') write += 1;
  }
  return { read, write };
}

/** Consent holds retain precedence over every role grant. */
export function isConsentHold(consent?: ConsentStatus): boolean {
  return consent === 'rescinded' || consent === 'pending' || consent === 'expired';
}
