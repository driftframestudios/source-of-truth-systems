import type { RoleId } from './access';
export type SourceType =
  | 'notion_page'
  | 'uploaded_file'
  | 'generated_svg'
  | 'scientific_ref'
  | 'exemplar_image'
  | 'planning_page'
  | 'yaml_manifest'
  | 'json_manifest';

export type SourceRole =
  | 'loam_context'
  | 'visual_authority'
  | 'scientific_authority'
  | 'latest_refinement'
  | 'generated_artifact'
  | 'context_only'
  | 'generation_distillation';

export type SourceStatus =
  | 'active'
  | 'deferred'
  | 'needs_fetch'
  | 'superseded'
  | 'stable'
  | 'exploratory';

export type AuthorityDomain =
  | 'diagram_purpose'
  | 'current_posture'
  | 'geometric_grammar'
  | 'aesthetic_nuance'
  | 'scientific_terminology'
  | 'visual_orientation'
  | 'generation_instructions'
  | 'latest_human_refinements'
  | 'artifact_state'
  | 'intended_target'
  | 'process_labels';

export interface Source {
  readonly id: string;
  readonly title: string;
  readonly type: SourceType;
  readonly role: SourceRole;
  readonly status: SourceStatus;
  readonly trustScope: ReadonlyArray<AuthorityDomain>;
  readonly notAuthoritativeFor: ReadonlyArray<AuthorityDomain>;
  readonly lastUpdated: string;
  readonly confidenceScore: number;
  readonly description: string;
  readonly tags: ReadonlyArray<string>;
}

export type InstructionStatus = 'active' | 'deferred' | 'superseded' | 'target_state';

export type InstructionCategory =
  | 'aesthetic'
  | 'geometric'
  | 'scientific'
  | 'accessibility'
  | 'rendering_order'
  | 'operational'
  | 'typography';

export type ArcId = 'arc_01' | 'arc_02' | 'arc_03' | 'future';

export type InstructionPriority = 'high' | 'medium' | 'low';

export interface Instruction {
  readonly id: string;
  readonly text: string;
  readonly sourceId: string;
  readonly status: InstructionStatus;
  readonly category: InstructionCategory;
  readonly appliesTo: ReadonlyArray<string>;
  readonly arc: ArcId;
  readonly priority: InstructionPriority;
  readonly reason: string;
}

export type ArtifactType = 'svg' | 'png' | 'pdf' | 'yaml' | 'json' | 'markdown';

export type AcceptanceResult = 'pass' | 'fail' | 'review' | 'pending';

export interface AcceptanceCheck {
  readonly name: string;
  readonly result: AcceptanceResult;
  readonly note: string;
}

export interface Artifact {
  readonly id: string;
  readonly title: string;
  readonly type: ArtifactType;
  readonly arc: ArcId;
  readonly pass: number;
  readonly derivedFrom: ReadonlyArray<string>;
  readonly changed: ReadonlyArray<string>;
  readonly deferred: ReadonlyArray<string>;
  readonly acceptanceChecks: ReadonlyArray<AcceptanceCheck>;
  readonly createdAt: string;
  readonly contentHash: string;
  readonly fileSize: string;
}

export type RelationshipType =
  | 'governs'
  | 'clarifies'
  | 'condenses'
  | 'reinforces'
  | 'supersedes'
  | 'validates'
  | 'informs'
  | 'links'
  | 'refines'
  | 'reveals'
  | 'derived_from';

export type RelationshipStrength = 'primary' | 'secondary' | 'weak';

export interface Relationship {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly type: RelationshipType;
  readonly strength: RelationshipStrength;
  readonly description: string;
}

export type ComparisonMode =
  | 'source_vs_source'
  | 'instruction_vs_artifact'
  | 'artifact_vs_exemplar'
  | 'arc_vs_arc'
  | 'target_vs_current';

export type ResolutionStatus = 'resolved' | 'pending' | 'deferred' | 'conflict';

export interface ComparisonItem {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly statement: string;
  readonly itemStatus: 'active' | 'partially_superseded' | 'superseded';
}

export interface Comparison {
  readonly id: string;
  readonly topic: string;
  readonly mode: ComparisonMode;
  readonly itemA: ComparisonItem;
  readonly itemB: ComparisonItem;
  readonly resolution: string;
  readonly resolutionStatus: ResolutionStatus;
  readonly arc: ArcId;
}

export interface Decision {
  readonly id: string;
  readonly title: string;
  readonly rationale: string;
  readonly sourceIds: ReadonlyArray<string>;
  readonly date: string;
  readonly status: 'confirmed' | 'tentative' | 'revisited';
  readonly arc: ArcId;
  readonly category: InstructionCategory;
}

export interface GenerationPacket {
  readonly arc: ArcId;
  readonly arcLabel: string;
  readonly objective: string;
  readonly activeSources: ReadonlyArray<string>;
  readonly activeInstructions: ReadonlyArray<string>;
  readonly deferred: ReadonlyArray<string>;
  readonly validationChecks: ReadonlyArray<string>;
  readonly readinessScore: number;
}

export interface Landmark {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly sourceId: string;
  readonly iconName: string;
}

// ------------------------------------------------------------
// Operational state — surfaced on Map cards so operators can
// advance review, sample, lab, and order state in-context.
// ------------------------------------------------------------

export type NodeCategory =
  | 'source'
  | 'infrastructure'
  | 'instrument'
  | 'pipeline'
  | 'reference'
  | 'governance'
  | 'specimen'
  | 'artifact';

export type ReviewState =
  | 'unreviewed'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'signed_off';

// Display vocabulary for the existing state strips. Accepted specimen/biomarker
// transitions are event tables in services/recordSession.ts, independent of order.
export const REVIEW_FLOW: ReadonlyArray<ReviewState> =
  ['unreviewed', 'in_review', 'changes_requested', 'approved', 'signed_off'];

export type SampleState =
  | 'received'
  | 'accessioned'
  | 'in_process'
  | 'sequenced'
  | 'analyzed'
  | 'reported'
  | 'archived';

export const SAMPLE_FLOW: ReadonlyArray<SampleState> =
  ['received', 'accessioned', 'in_process', 'sequenced', 'analyzed', 'reported', 'archived'];

export type LabState = 'wet_lab' | 'dry_lab' | 'interpretation' | 'infrastructure';

export type OrderState =
  | 'draft'
  | 'placed'
  | 'in_progress'
  | 'on_hold'
  | 'fulfilled'
  | 'cancelled';

export const ORDER_FLOW: ReadonlyArray<OrderState> =
  ['draft', 'placed', 'in_progress', 'on_hold', 'fulfilled', 'cancelled'];

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  readonly x: number;
  readonly y: number;
  readonly type: SourceType;
  readonly role: SourceRole;
  readonly status: SourceStatus;
  // Optional operational / provenance metadata (biopharma platform nodes).
  readonly category?: NodeCategory;
  readonly description?: string;
  readonly system?: string;          // e.g. "S3 · us-east-1", "AWS Batch"
  readonly owner?: string;           // owning team / principal
  readonly geographyCode?: string;   // USE / EUW / APA …
  readonly dataClass?: 'synthetic' | 'de_identified' | 'limited' | 'phi';
  readonly populations?: ReadonlyArray<string>;  // population registers served
  readonly minWriteRole?: RoleId;    // lowest role permitted to mutate
  readonly reviewState?: ReviewState;
  readonly sampleState?: SampleState;
  readonly labState?: LabState;
  readonly orderState?: OrderState;
}

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: RelationshipType;
  readonly color: string;
  readonly fromOffsetX?: number;
  readonly toOffsetX?: number;
}

export interface CartographyStore {
  readonly sources: ReadonlyArray<Source>;
  readonly instructions: ReadonlyArray<Instruction>;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly relationships: ReadonlyArray<Relationship>;
  readonly comparisons: ReadonlyArray<Comparison>;
  readonly decisions: ReadonlyArray<Decision>;
  readonly generationPacket: GenerationPacket;
  readonly landmarks: ReadonlyArray<Landmark>;
  readonly graphNodes: ReadonlyArray<GraphNode>;
  readonly graphEdges: ReadonlyArray<GraphEdge>;
  readonly lanes: ReadonlyArray<Lane>;
  readonly laneCards: ReadonlyArray<LaneCard>;
  readonly laneArrows: ReadonlyArray<LaneArrow>;
  readonly laneFlags: ReadonlyArray<LaneFlag>;
  readonly laneSurfaceLabels: ReadonlyArray<LaneSurfaceLabel>;
  readonly streams: ReadonlyArray<DataStream>;
  readonly connections: ReadonlyArray<ThirdPartyConnection>;
  readonly plate: ReadonlyArray<Well>;
  readonly wellResults: ReadonlyArray<WellResult>;
  readonly lifecycleRules: ReadonlyArray<LifecycleRule>;
  readonly specimens: ReadonlyArray<Specimen>;
  readonly qcMetrics: ReadonlyArray<QCMetric>;
  readonly qcGates: ReadonlyArray<QCGate>;
  readonly biomarkers: ReadonlyArray<Biomarker>;
}

// ============================================================
// Lanes — genomics process corridors
// ============================================================

export type LaneId =
  | 'lane_accession'
  | 'lane_extraction'
  | 'lane_library'
  | 'lane_sequencer'
  | 'lane_secondary'
  | 'lane_variant_review'
  | 'lane_cancer_biology'
  | 'lane_reciprocal'
  | 'lane_qa_release'
  | 'lane_reporting'
  | 'lane_interfacing';

export interface Lane {
  readonly id: LaneId;
  readonly label: string;
  readonly shortLabel: string;
  readonly color: string;
  readonly accentColor: string;
  readonly order: number;
  readonly description: string;
  readonly stage: 'wet_lab' | 'dry_lab' | 'interpretation';
}

export type LaneCardKind =
  | 'process'         // light card (default)
  | 'state_major'    // colored state placard — yellow/teal
  | 'state_minor'    // smaller colored placard — orange
  | 'control'         // grey control card
  | 'nested';         // small card inside a larger one

export type PennantKind = 'spe' | 'per' | 'drean' | 'review' | 'qc';

export interface Pennant {
  readonly kind: PennantKind;
  readonly label: string;
}

export interface NestedCard {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
}

export interface CardCrossRefs {
  readonly sourceIds?: ReadonlyArray<string>;
  readonly instructionIds?: ReadonlyArray<string>;
  readonly artifactIds?: ReadonlyArray<string>;
  readonly comparisonIds?: ReadonlyArray<string>;
  readonly decisionIds?: ReadonlyArray<string>;
}

export interface LaneCard {
  readonly id: string;
  readonly laneId: LaneId;
  readonly kind: LaneCardKind;
  readonly label: string;
  readonly position: number; // 0..1 along lane
  readonly artifactRef?: string;
  readonly streamRef?: string;
  readonly note?: string;
  readonly pennants?: ReadonlyArray<Pennant>;
  readonly nested?: ReadonlyArray<NestedCard>;
  readonly crossRefs?: CardCrossRefs;
  readonly contaminationProb?: number; // 0..1 — probability this stage introduces contamination
}

export interface LaneArrow {
  readonly id: string;
  readonly fromCardId: string;
  readonly toCardId: string;
  readonly kind: 'flow' | 'reciprocal' | 'review' | 'deferred';
}

export type LaneFlagKind = 'milestone' | 'gate' | 'handoff' | 'checkered' | 'caution';

export interface LaneFlag {
  readonly id: string;
  readonly laneId: LaneId;
  readonly position: number; // 0..1 along lane
  readonly kind: LaneFlagKind;
  readonly label: string;
  readonly sublabel?: string;
}

export interface LaneSurfaceLabel {
  readonly id: string;
  readonly laneId: LaneId;
  readonly position: number; // 0..1 along lane
  readonly text: string;
  readonly tone?: 'primary' | 'muted' | 'warn';
}

// 96-well sample plate
export type WellRole = 'sample' | 'positive_control' | 'negative_control' | 'empty';

export type SampleAssay = 'wgs' | 'wes' | 'panel_solid' | 'panel_heme' | 'rna_seq' | 'methylation';
export type SamplePriority = 'routine' | 'expedited' | 'stat';

// Consent posture propagates in from the Consent Registry (owned by the
// Clinical Governance department). The platform treats it as read-only,
// authoritative, and analysis-gating: a rescinded specimen must be held.
export type ConsentStatus = 'active' | 'pending' | 'rescinded' | 'expired';

export interface Well {
  readonly row: number; // 0..7 (A..H)
  readonly col: number; // 0..11 (1..12)
  readonly role: WellRole;
  readonly sampleId?: string;
  readonly contaminationProb?: number; // 0..1; omitted outside the permitted field scope
  readonly laneCardId?: string;
  readonly assay?: SampleAssay;
  readonly priority?: SamplePriority;
  readonly patientCode?: string;     // de-identified
  readonly tumorPercent?: number;    // 0..100 for tumor samples
  readonly volumeUl?: number;
  readonly concentrationNgUl?: number;
  readonly dinScore?: number;        // 1–10
  readonly accessionedAt?: string;
  readonly note?: string;
  readonly consentStatus?: ConsentStatus;
  readonly consentSetBy?: string;    // originating department/system
  readonly consentUpdatedAt?: string;
}

// ============================================================
// Well result stacks — every sequencing / analysis result that
// resolves to a plate well (reruns, re-preps, reanalyses and
// longitudinal draws linked back to the anchor well), plus the
// storage posture of every file each result produced. Drives the
// upright "result stack" plate view.
// ============================================================

export type ResultKind =
  | 'primary'          // first result for the specimen on this plate
  | 'top_up'           // same library re-sequenced to reach target depth
  | 'reprep'           // new extraction / library from residual material
  | 'reanalysis'       // computational only — same reads, new pipeline / annotation
  | 'longitudinal'     // a new timepoint (e.g. plasma draw) for the same patient
  | 'matched_normal'   // germline comparator (buffy coat, PBMC, trio parent)
  | 'orthogonal'       // confirmation by an independent method
  | 'reflex'           // escalation to a companion / broader assay
  | 'control';         // run control

export type ResultStatus =
  | 'reportable'       // the source-of-truth result for its timepoint
  | 'superseded'
  | 'failed_qc'
  | 'in_progress'
  | 'held'             // consent hold — withheld from analysis and release
  | 'cancelled'
  | 'informational';

export type ArtifactKind = 'qc' | 'vcf' | 'calls' | 'gvcf' | 'bam' | 'cram' | 'fastq' | 'idat';

export type StorageClassId =
  | 'standard'
  | 'intelligent_tiering'
  | 'standard_ia'
  | 'glacier_ir'
  | 'glacier_flexible'
  | 'deep_archive'
  | 'expired';

export type LifecycleRuleId =
  | 'lc-qc-pinned'
  | 'lc-vcf-hot'
  | 'lc-bam-v3'
  | 'lc-cram-archive'
  | 'lc-fastq-deep'
  | 'lc-idat-hot';

export interface LifecycleTransition {
  readonly atDay: number;              // object age (days) at which this class begins
  readonly storageClass: StorageClassId;
}

export interface LifecycleRule {
  readonly id: LifecycleRuleId;
  readonly prefix: string;             // S3 key prefix the rule filters on
  readonly summary: string;            // plain-language summary for scientists
  readonly transitions: ReadonlyArray<LifecycleTransition>; // ascending; first atDay is 0
  readonly expireAtDay?: number;       // current version deleted at this age
  readonly retentionNote?: string;
}

export type RestoreTier = 'expedited' | 'standard' | 'bulk';

export interface ArtifactRestore {
  readonly state: 'in_progress' | 'restored';
  readonly tier: RestoreTier;
  readonly requestedAt: string;        // ISO datetime
  readonly readyAt?: string;           // ISO datetime — expected or actual
  readonly expiresAt?: string;         // ISO date — temporary restored copy expiry
}

export interface ResultArtifact {
  readonly kind: ArtifactKind;
  readonly sizeBytes: number;
  readonly createdAt: string;          // ISO date — lifecycle age is measured from here
  readonly ruleId: LifecycleRuleId;
  readonly key: string;                // object key under the environment's streams bucket
  readonly restore?: ArtifactRestore;
  readonly legalHold?: boolean;        // S3 Object Lock legal hold
  readonly reusedFrom?: string;        // result id whose object this result points at
}

export interface ResultMetric {
  readonly key: string;                // stable key so reruns can be diffed
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly target?: number;
  readonly comparator?: 'gte' | 'lte';
}

export interface CtDnaReadout {
  readonly detected: boolean;
  readonly meanVafPct: number;         // mean VAF across tracked variants, %
  readonly tracked: number;            // variants on the personalized panel
  readonly detectedCount: number;      // tracked variants observed in this draw
  readonly mtmPerMl?: number;          // mean tumor molecules per mL plasma
  readonly emerging?: string;          // novel variant not in the tumor anchor
}

export interface ResultTrigger {
  readonly source: string;             // e.g. "Secondary Analysis Gate"
  readonly refId?: string;             // QC gate / metric id when applicable
  readonly detail: string;
}

export interface WellResult {
  readonly id: string;
  readonly wellId: string;             // anchor well on the plate, e.g. "B4"
  readonly seq: number;                // 0 = seated in the well; increases outward
  readonly kind: ResultKind;
  readonly status: ResultStatus;
  readonly label: string;              // short disc label, e.g. "T2"
  readonly title: string;
  readonly specimenType: string;
  readonly assayLabel: string;
  readonly plateId: string;            // physical plate the aliquot ran on
  readonly plateWell: string;          // physical well on that plate
  readonly flowCell?: string;
  readonly pipeline: string;
  readonly runDate: string;            // ISO date
  readonly reason: string;             // plain-language "why this result exists"
  readonly trigger?: ResultTrigger;
  readonly supersedes?: string;        // id of the result this one replaces
  readonly metrics: ReadonlyArray<ResultMetric>;
  readonly finding?: string;
  readonly ctDna?: CtDnaReadout;
  readonly artifacts: ReadonlyArray<ResultArtifact>;
  /** The visible file list is a scoped subset; absence does not establish non-production. */
  readonly artifactsRestricted?: boolean;
  readonly consent: ConsentStatus;
  readonly minWriteRole: RoleId;
  readonly specimenId?: string;
  readonly patientCode?: string;
  readonly seriesLabel?: string;       // story the stack tells, e.g. "Tumor-informed ctDNA"
}

// ============================================================
// Specimen-level view — masonry cards
// ============================================================

export type SpecimenStage =
  | 'accessioned' | 'extraction' | 'library' | 'sequencing'
  | 'secondary' | 'variant_review' | 'reported' | 'on_hold';

export interface SpecimenTimelineStep {
  readonly label: string;
  readonly at: string;
  readonly done: boolean;
}

export interface SpecimenCoverageBar {
  readonly label: string;
  readonly value: number;
  readonly target: number;
  readonly comparator: 'gte' | 'lte'; // Explicit synthetic target direction, independent of the label.
  readonly unit?: string;
}

export interface Specimen {
  readonly id: string;                 // accession id, e.g. SPX-2026-0481
  readonly patientCode: string;        // de-identified
  readonly assay: SampleAssay;
  readonly priority: SamplePriority;
  readonly stage: SpecimenStage;
  readonly consent: ConsentStatus;
  readonly consentSetBy: string;
  readonly dataClass: 'synthetic' | 'de_identified' | 'limited' | 'phi';
  readonly geographyCode: string;      // USE / EUW / ...
  readonly indication: string;         // e.g. "NSCLC, stage IV"
  readonly specimenType: string;       // FFPE block, whole blood, ...
  readonly tumorPercent?: number;
  readonly plateWell?: string;         // e.g. "D3"
  readonly minWriteRole: RoleId;
  readonly reviewState: ReviewState;
  readonly sampleState: SampleState;
  readonly orderState: OrderState;
  readonly qcFlags: ReadonlyArray<string>;
  readonly coverage: ReadonlyArray<SpecimenCoverageBar>;
  readonly timeline: ReadonlyArray<SpecimenTimelineStep>;
  readonly variantsCalled?: number;
  readonly note?: string;
  readonly accessionedAt: string;
}

// ============================================================
// Quality Control panel
// ============================================================

export type QCStatus = 'pass' | 'warn' | 'fail' | 'pending';
export type QCStage = 'wet_lab' | 'sequencing' | 'secondary' | 'sign_out';

export interface QCMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly threshold: number;
  readonly comparator: 'gte' | 'lte';   // pass if value >= / <= threshold
  readonly status: QCStatus;
  readonly stage: QCStage;
  readonly trend: ReadonlyArray<number>; // sparkline series
}

export interface QCGate {
  readonly id: string;
  readonly label: string;
  readonly stage: QCStage;
  readonly status: QCStatus;
  readonly description: string;
  readonly owner: string;
  readonly minWriteRole: RoleId;
  readonly metricIds: ReadonlyArray<string>;
  readonly specimenScope: string;        // e.g. "Run NVSX-2026-118 · 88 specimens"
  readonly blocking: boolean;
}

// ============================================================
// Biomarker panel
// ============================================================

export type BiomarkerCategory = 'somatic' | 'germline' | 'signature' | 'expression' | 'pgx';
export type BiomarkerActionability = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'none';

export interface Biomarker {
  readonly id: string;
  readonly name: string;               // e.g. "KRAS G12C"
  readonly gene?: string;
  readonly category: BiomarkerCategory;
  readonly value: string;              // display value, e.g. "Detected · VAF 34%"
  readonly numericValue?: number;      // for meter rendering
  readonly unit?: string;
  readonly actionability: BiomarkerActionability;
  readonly evidence: ReadonlyArray<string>; // OncoKB, COSMIC, ClinVar ...
  readonly therapies: ReadonlyArray<string>;
  readonly reviewState: ReviewState;
  readonly specimenId: string;
  readonly indication: string;
  readonly minWriteRole: RoleId;
  readonly note?: string;
}

export type StreamType =
  | 'bcl'
  | 'fastq'
  | 'bam'
  | 'cram'
  | 'vcf'
  | 'gvcf'
  | 'bed'
  | 'manifest'
  | 'qc_metrics'
  | 'run_metadata';

export interface DataStream {
  readonly id: string;
  readonly type: StreamType;
  readonly label: string;
  readonly producedByLane: LaneId;
  readonly consumedByLane: LaneId | null;
  readonly format: string;
  readonly approxSize: string;
}

export type ConnectionVendor =
  | 'illumina'
  | 'dragen'
  | 'gatk'
  | 'igv'
  | 'cosmic'
  | 'clinvar'
  | 'oncokb'
  | 'lims'
  | 'aws_s3'
  | 'notion';

export interface ThirdPartyConnection {
  readonly id: string;
  readonly vendor: ConnectionVendor;
  readonly label: string;
  readonly purpose: string;
  readonly laneId: LaneId | null;
  readonly authRequired: boolean;
  readonly online: boolean;
}

// ============================================================
// Error & Notification system
// ============================================================

export type AppErrorCode =
  | 'SOURCE_FETCH_FAILED'
  | 'SOURCE_PARSE_INVALID'
  | 'INSTRUCTION_CONFLICT'
  | 'ARTIFACT_HASH_MISMATCH'
  | 'STREAM_TIMEOUT'
  | 'CONNECTION_AUTH_EXPIRED'
  | 'CONNECTION_OFFLINE'
  | 'LANE_GEOMETRY_VIOLATION'
  | 'COMPARISON_UNRESOLVED'
  | 'PACKET_VALIDATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_UNEXPECTED';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AppError {
  readonly id: string;
  readonly code: AppErrorCode;
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly message: string;
  readonly subjectId?: string;
  readonly recoverable: boolean;
  readonly suggestedAction?: string;
  readonly timestamp: string;
}

export type NotificationKind = 'toast' | 'banner';

export interface AppNotification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly severity: ErrorSeverity;
  readonly title: string;
  readonly message: string;
  readonly persistent: boolean;
  readonly createdAt: number;
  readonly errorRef?: string;
}
