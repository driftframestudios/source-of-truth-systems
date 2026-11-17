import type { RoleId } from '../types/access';
import type {
  Source, Instruction, Artifact, Relationship, Comparison,
  Decision, GenerationPacket, Landmark, GraphNode, GraphEdge,
  CartographyStore, Lane, LaneCard, DataStream, ThirdPartyConnection,
  LaneArrow, Well, WellRole, LaneFlag, LaneSurfaceLabel,
  SampleAssay, SamplePriority,
  Specimen, QCMetric, QCGate, Biomarker,
} from '../types';
import {
  LIFECYCLE_RULES, PLATE_WELL_OVERRIDES, buildWellResults, wellIdOf,
} from './wellResults';

const SOURCES: ReadonlyArray<Source> = [
  {
    id: 'notion_fragment',
    title: 'Genomics program brief',
    type: 'notion_page',
    role: 'loam_context',
    status: 'active',
    trustScope: ['diagram_purpose', 'current_posture', 'process_labels'],
    notAuthoritativeFor: ['scientific_terminology'],
    lastUpdated: '2026-05-28',
    confidenceScore: 88,
    description: 'Program brief stored in a versioned S3 bucket. Records genomic pipeline priorities, AWS constraints, and operating runbooks for laboratory, bioinformatics, clinical review, and platform teams.',
    tags: ['s3', 'program', 'priorities', 'primary', 'release-02'],
  },
  {
    id: 'yaml_context',
    title: 'Pipeline configuration manifest',
    type: 'yaml_manifest',
    role: 'generation_distillation',
    status: 'active',
    trustScope: ['generation_instructions', 'geometric_grammar'],
    notAuthoritativeFor: ['aesthetic_nuance', 'scientific_terminology'],
    lastUpdated: '2026-05-25',
    confidenceScore: 92,
    description: 'Version-controlled YAML configuration for the genomic pipeline. Records workflow stages, AWS Batch queues, container digests, and reference bundle locations used in the release plan.',
    tags: ['yaml', 'pipeline', 'configuration', 'release'],
  },
  {
    id: 'exemplar_alignment',
    title: 'Shared pipeline specification',
    type: 'planning_page',
    role: 'visual_authority',
    status: 'active',
    trustScope: ['visual_orientation', 'geometric_grammar', 'aesthetic_nuance'],
    notAuthoritativeFor: ['scientific_terminology', 'process_labels'],
    lastUpdated: '2026-05-20',
    confidenceScore: 95,
    description: 'Governs the primary schema rule: build every pipeline from one shared Step Functions definition rather than independently configured runs. Establishes the sample, run, and analysis key system and a common accession baseline.',
    tags: ['specification', 'pipeline', 'step-functions', 'shared-schema', 'primary'],
  },
  {
    id: 'reinforcing_surface',
    title: 'Cohort workflow notes',
    type: 'planning_page',
    role: 'context_only',
    status: 'active',
    trustScope: ['aesthetic_nuance', 'diagram_purpose'],
    notAuthoritativeFor: ['geometric_grammar', 'scientific_terminology', 'generation_instructions'],
    lastUpdated: '2026-05-18',
    confidenceScore: 72,
    description: 'Cohort workflow notes describe sample volumes, assay mix, and handoffs between laboratory and bioinformatics teams. They inform capacity discussions; approved pipeline specifications govern implementation.',
    tags: ['cohort', 'capacity', 'workflow', 'context'],
  },
  {
    id: 'narrowing_file',
    title: 'Platform delivery updates',
    type: 'uploaded_file',
    role: 'latest_refinement',
    status: 'active',
    trustScope: ['latest_human_refinements', 'geometric_grammar', 'aesthetic_nuance'],
    notAuthoritativeFor: ['scientific_terminology'],
    lastUpdated: '2026-05-29',
    confidenceScore: 97,
    description: 'Platform team decisions on LIMS stage binding, private VPC compute, and S3 provenance. Records the current delivery scope and the capacity and failover work planned for later releases.',
    tags: ['delivery', 'decisions', 'uploaded', 'latest', 'primary'],
  },
  {
    id: 'arc01_pass5',
    title: 'Release 01 architecture baseline',
    type: 'generated_svg',
    role: 'generated_artifact',
    status: 'stable',
    trustScope: ['artifact_state'],
    notAuthoritativeFor: ['intended_target', 'latest_human_refinements'],
    lastUpdated: '2026-05-15',
    confidenceScore: 81,
    description: 'Architecture snapshot for Release 01, revision 5. Records the shared pipeline schema, private compute boundaries, and provenance paths used to review the next release.',
    tags: ['release-01', 'architecture', 'stable', 'reference', 'revision-5'],
  },
  {
    id: 'illumina_docs',
    title: 'Illumina Official Documentation — NovaSeq 6000/X Genomics Workflow',
    type: 'scientific_ref',
    role: 'scientific_authority',
    status: 'needs_fetch',
    trustScope: ['scientific_terminology'],
    notAuthoritativeFor: ['visual_orientation', 'geometric_grammar', 'aesthetic_nuance', 'process_labels'],
    lastUpdated: '2026-04-10',
    confidenceScore: 99,
    description: 'Vendor documentation for sequencing workflow and terminology. The linked copy needs a currency review before the next release review.',
    tags: ['scientific', 'illumina', 'genomics', 'official', 'terminology'],
  },
  {
    id: 'arc02_packet',
    title: 'Release 02 delivery plan',
    type: 'yaml_manifest',
    role: 'generation_distillation',
    status: 'active',
    trustScope: ['generation_instructions', 'geometric_grammar', 'latest_human_refinements'],
    notAuthoritativeFor: ['scientific_terminology', 'aesthetic_nuance'],
    lastUpdated: '2026-05-30',
    confidenceScore: 94,
    description: 'Delivery plan for Release 02. Collects approved sources, implementation requirements, review checks, and deferred platform work.',
    tags: ['release-02', 'plan', 'requirements', 'active'],
  },
];

const INSTRUCTIONS: ReadonlyArray<Instruction> = [
  {
    id: 'PIPE-STAGE-001',
    text: "Every pipeline run inherits the stage of its controlling specimen-state record in LIMS, so a sequencing plate moves through Step Functions as one coherent workflow.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['step_functions','lims_state','run_metadata'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Keeping specimen state and pipeline stage in lockstep keeps each LIMS workflow traceable before platform refinements land.",
  },
  {
    id: 'BATCH-QUEUE-001',
    text: "Secondary-analysis jobs take priority over per-sample QC in AWS Batch, preserving DRAGEN alignment capacity as MultiQC work scales.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['aws_batch','job_queues','qc_pipeline'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Preserves turnaround on clinical calls while QC scales opportunistically.",
  },
  {
    id: 'VPC-CONTAIN-001',
    text: "Compute that touches PHI-linked data runs only inside the private VPC subnets for its region, with no NAT egress.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['vpc','private_subnets','phi_vault'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Workloads reaching across subnets implied cross-region data movement in Release 01 revisions 3–4.",
  },
  {
    id: 'EC2-RIGHTSIZE-001',
    text: "EC2 instance families per pipeline stage are pinned in the launch template: F1 for DRAGEN, r6i for joint genotyping, c6i for annotation.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['ec2','launch_templates','aws_batch'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Right-sized instances keep cost per genome predictable and prevent OOM retries on GATK.",
  },
  {
    id: 'S3-LINEAGE-001',
    text: "Every pipeline step writes a provenance record (input digests, image digest, reference build) next to its S3 outputs.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'scientific',
    appliesTo: ['s3_lineage','provenance','step_functions'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Provenance records tie each VCF back to its BAM and FASTQ, preventing the orphaned outputs seen in Release 01 revision 4.",
  },
  {
    id: 'S3-PREFIX-001',
    text: "Each stage stores its provenance records under its own S3 prefix.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['s3_lineage','bucket_layout'],
    arc: 'arc_02',
    priority: 'medium',
    reason: "Per-stage prefixes let Lake Formation grants and lifecycle rules follow the data.",
  },
  {
    id: 'SPOT-FALLBACK-001',
    text: "STAT runs use On-Demand compute environments. Evaluate automatic Spot fallback in a future release after collecting interruption telemetry.",
    sourceId: 'narrowing_file',
    status: 'deferred',
    category: 'operational',
    appliesTo: ['aws_batch','spot_capacity','priority'],
    arc: 'future',
    priority: 'low',
    reason: "Collect interruption telemetry before evaluating fallback logic.",
  },
  {
    id: 'MULTI-REGION-001',
    text: "Active-active pipeline failover between us-east-1 and eu-west-1 is deferred until residency rules are codified in Terraform.",
    sourceId: 'narrowing_file',
    status: 'deferred',
    category: 'operational',
    appliesTo: ['multi_region','terraform','residency'],
    arc: 'future',
    priority: 'low',
    reason: "GDPR residency makes naive replication unsafe; failover must respect Lake Formation grants.",
  },
  {
    id: 'IMG-PIN-001',
    text: "Pipeline containers are referenced by ECR image digest, never by a mutable tag like :latest.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['docker','ecr','reproducibility'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Digest pinning is what makes a validated DRAGEN or GATK run reproducible in VAL and PROD.",
  },
  {
    id: 'PHI-SCOPE-001',
    text: "Job names, S3 keys, CloudWatch log streams, and container env vars carry only de-identified specimen codes, never patient identifiers or accession IDs.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'scientific',
    appliesTo: ['cloudwatch','s3_keys','job_naming','phi_vault'],
    arc: 'arc_02',
    priority: 'high',
    reason: "PHI and consent state live only in access-gated LIMS and the PHI linkage vault; logs and object keys travel far wider.",
  },
  {
    id: 'REF-GENOME-001',
    text: "All pipelines resolve the same pinned reference bundle (GRCh38 + decoys, dbSNP, gnomAD version) from one versioned S3 location.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'scientific',
    appliesTo: ['reference_genome','annotation','dragen','gatk'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Mixed reference builds make concordance between DRAGEN and GATK meaningless and fail validation.",
  },
  {
    id: 'TF-MODULE-001',
    text: "Provision every stage from the shared Terraform modules for network, Batch, storage and IAM.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['terraform','iam','aws_batch','vpc'],
    arc: 'arc_02',
    priority: 'high',
    reason: "Shared modules keep Validation and Production configurations reproducible and comparable.",
  },
  {
    id: 'CLUSTER-SCALE-001',
    text: "Compute environment max vCPUs scale with workload: large for sequencing and secondary analysis, small for sign-out and reporting services.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['aws_batch','compute_environments','autoscaling'],
    arc: 'arc_02',
    priority: 'medium',
    reason: "Capacity sized to throughput keeps queue latency low without idle spend.",
  },
  {
    id: 'KMS-ENCRYPT-001',
    text: "Every bucket and EBS volume holding genomic data uses a customer-managed KMS key scoped to its geography.",
    sourceId: 'narrowing_file',
    status: 'active',
    category: 'operational',
    appliesTo: ['kms','s3','ebs','residency'],
    arc: 'arc_02',
    priority: 'medium',
    reason: "Per-region CMKs let Compliance revoke access to a geography without touching others.",
  },
  {
    id: 'AUTOSCALE-PRED-001',
    text: "Predictive scaling of Batch compute from the LIMS run calendar is a future capacity-planning service.",
    sourceId: 'narrowing_file',
    status: 'deferred',
    category: 'operational',
    appliesTo: ['autoscaling','lims_calendar','aws_batch'],
    arc: 'future',
    priority: 'low',
    reason: "Needs stable run-calendar data; defer until queue priorities and right-sizing are settled.",
  },
];

const ARTIFACTS: ReadonlyArray<Artifact> = [
  {
    id: 'arc01_pass1',
    title: 'Platform bootstrap',
    type: 'yaml',
    arc: 'arc_01',
    pass: 1,
    derivedFrom: ['notion_fragment', 'yaml_context'],
    changed: ["initial VPC and S3 buckets", "first AWS Batch compute environment", "hand-built DRAGEN AMI"],
    deferred: ["stage binding", "VPC containment", "provenance tracing", "Terraform modules"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'fail', note: "DRAGEN and GATK resolve different GRCh37/38 builds" },
      { name: "Images pinned by digest", result: 'review', note: "Containers pulled by :latest tag" },
      { name: "PHI compute inside VPC", result: 'fail', note: "Annotation jobs run in a public subnet with NAT egress" },
      { name: "De-identified job & log names", result: 'pass', note: "Job names carry de-identified codes only" },
    ],
    createdAt: '2026-04-02',
    contentHash: 'sha256:a3f4b2c1d9e8f7a6b5c4d3e2f1a0b9c8',
    fileSize: '148 KB',
  },
  {
    id: 'arc01_pass2',
    title: 'Terraform baseline',
    type: 'yaml',
    arc: 'arc_01',
    pass: 2,
    derivedFrom: ['arc01_pass1', 'exemplar_alignment'],
    changed: ["network + storage moved to Terraform modules", "shared sample/run/analysis schema in Glue", "Batch queue priorities introduced"],
    deferred: ["stage binding", "provenance tracing", "ECR digest pinning"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'review', note: "Pinned in DRAGEN; GATK still drifts on dbSNP version" },
      { name: "Images pinned by digest", result: 'review', note: "ECR in use; some jobs still on mutable tags" },
      { name: "PHI compute inside VPC", result: 'fail', note: "EU annotation compute reachable from us-east-1 VPC peering" },
      { name: "De-identified job & log names", result: 'pass', note: "" },
    ],
    createdAt: '2026-04-10',
    contentHash: 'sha256:b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2',
    fileSize: '162 KB',
  },
  {
    id: 'arc01_pass3',
    title: 'Batch capacity sizing',
    type: 'yaml',
    arc: 'arc_01',
    pass: 3,
    derivedFrom: ['arc01_pass2', 'exemplar_alignment', 'narrowing_file'],
    changed: ["EC2 families pinned per stage (F1, r6i, c6i)", "KMS CMKs per region", "all compute from Terraform modules"],
    deferred: ["stage binding to LIMS state", "provenance tracing"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'pass', note: "All 7 pipelines resolve the same GRCh38 bundle" },
      { name: "Images pinned by digest", result: 'review', note: "Two QC jobs still reference :latest" },
      { name: "PHI compute inside VPC", result: 'review', note: "EU peering removed; one SageMaker endpoint still public" },
      { name: "Provenance traced to S3 lineage", result: 'fail', note: "No provenance records yet" },
      { name: "De-identified job & log names", result: 'pass', note: "" },
    ],
    createdAt: '2026-04-22',
    contentHash: 'sha256:c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
    fileSize: '189 KB',
  },
  {
    id: 'arc01_pass4',
    title: 'Provenance capture',
    type: 'yaml',
    arc: 'arc_01',
    pass: 4,
    derivedFrom: ['arc01_pass3', 'narrowing_file'],
    changed: ["provenance records added", "account-wide CloudTrail log approach (later corrected)", "pipeline milestone events to EventBridge"],
    deferred: ["stage binding to LIMS state", "provenance prefix scoping"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'pass', note: "" },
      { name: "Images pinned by digest", result: 'pass', note: "All jobs reference ECR digests" },
      { name: "PHI compute inside VPC", result: 'fail', note: "SageMaker CNV endpoint found outside VPC in security review" },
      { name: "Provenance traced to S3 lineage", result: 'review', note: "Records present but written to a global log bucket" },
      { name: "De-identified job & log names", result: 'pass', note: "" },
    ],
    createdAt: '2026-05-05',
    contentHash: 'sha256:d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6',
    fileSize: '211 KB',
  },
  {
    id: 'arc01_pass5',
    title: 'Validated platform baseline',
    type: 'yaml',
    arc: 'arc_01',
    pass: 5,
    derivedFrom: ['arc01_pass4', 'exemplar_alignment', 'narrowing_file'],
    changed: ["provenance scoped to stage S3 prefix", "SageMaker moved behind VPC endpoint", "QC queue demoted below secondary analysis", "three-tier specimen-state records in LIMS"],
    deferred: ["stage binding default", "Spot fallback", "multi-region failover"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'pass', note: "All 7 pipelines on pinned bundle" },
      { name: "Images pinned by digest", result: 'pass', note: "" },
      { name: "PHI compute inside VPC", result: 'review', note: "Contained; one VPC endpoint policy still overly broad" },
      { name: "Provenance traced to S3 lineage", result: 'pass', note: "Records written under each stage prefix" },
      { name: "De-identified job & log names", result: 'pass', note: "" },
      { name: "Buckets encrypted with regional CMKs", result: 'pass', note: "" },
    ],
    createdAt: '2026-05-15',
    contentHash: 'sha256:e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
    fileSize: '228 KB',
  },
  {
    id: 'arc02_pass1',
    title: 'Pipeline stage alignment',
    type: 'yaml',
    arc: 'arc_02',
    pass: 1,
    derivedFrom: ['arc01_pass5', 'exemplar_alignment', 'narrowing_file', 'arc02_packet'],
    changed: ["runs bound to LIMS specimen state before dispatch", "VPC endpoint policies narrowed", "S3 lineage capture standardized"],
    deferred: ["Spot → On-Demand fallback", "multi-region failover", "predictive autoscaling"],
    acceptanceChecks: [
      { name: "Reference bundle pinned", result: 'pass', note: "" },
      { name: "Images pinned by digest", result: 'pass', note: "" },
      { name: "PHI compute inside VPC", result: 'pass', note: "All PHI-linked compute in private subnets" },
      { name: "Provenance traced to S3 lineage", result: 'pass', note: "" },
      { name: "Pipeline stage matches LIMS state", result: 'pending', note: "Under review" },
      { name: "De-identified job & log names", result: 'pass', note: "" },
      { name: "Buckets encrypted with regional CMKs", result: 'pass', note: "" },
    ],
    createdAt: '2026-05-30',
    contentHash: 'sha256:f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
    fileSize: '241 KB',
  },
];

const RELATIONSHIPS: ReadonlyArray<Relationship> = [
  { id: 'r01', fromId: 'notion_fragment', toId: 'yaml_context', type: 'condenses', strength: 'primary', description: 'The pipeline configuration translates the program brief into versioned implementation settings.' },
  { id: 'r02', fromId: 'notion_fragment', toId: 'exemplar_alignment', type: 'links', strength: 'primary', description: 'The program brief names the shared pipeline specification as the source for workflow structure.' },
  { id: 'r03', fromId: 'notion_fragment', toId: 'reinforcing_surface', type: 'links', strength: 'secondary', description: 'The program brief links to cohort workflow notes for sample volumes and handoff context.' },
  { id: 'r04', fromId: 'exemplar_alignment', toId: 'arc02_packet', type: 'governs', strength: 'primary', description: 'The shared pipeline specification defines the workflow schema for Release 02.' },
  { id: 'r05', fromId: 'reinforcing_surface', toId: 'arc02_packet', type: 'reinforces', strength: 'secondary', description: 'Cohort workflow notes inform sample throughput and queue capacity planning.' },
  { id: 'r06', fromId: 'narrowing_file', toId: 'arc02_packet', type: 'refines', strength: 'primary', description: 'Platform delivery updates define the current requirements in the Release 02 plan.' },
  { id: 'r07', fromId: 'arc01_pass5', toId: 'arc02_packet', type: 'informs', strength: 'primary', description: 'Release 01 revision 5 is the architecture baseline for reviewing Release 02 changes.' },
  { id: 'r08', fromId: 'illumina_docs', toId: 'arc02_packet', type: 'validates', strength: 'secondary', description: 'Official scientific documentation validates lane labels and workflow terminology.' },
  { id: 'r09', fromId: 'narrowing_file', toId: 'arc01_pass5', type: 'clarifies', strength: 'secondary', description: 'Platform delivery updates record findings from the Release 01 revision 5 review.' },
  { id: 'r10', fromId: 'yaml_context', toId: 'arc02_packet', type: 'condenses', strength: 'secondary', description: 'The pipeline configuration supplies versioned settings for the Release 02 plan.' },
];

const COMPARISONS: ReadonlyArray<Comparison> = [
  {
    id: 'cmp_001',
    topic: "STAT Capacity: Spot vs On-Demand",
    mode: 'source_vs_source',
    itemA: {
      entityId: 'notion_fragment',
      entityLabel: "Program Posture (S3)",
      statement: "STAT orders must never wait on Spot capacity. Define automatic Spot → On-Demand fallback before scaling the cluster.",
      itemStatus: 'partially_superseded',
    },
    itemB: {
      entityId: 'narrowing_file',
      entityLabel: "Platform delivery updates",
      statement: "Fallback logic can wait. Route STAT runs to a dedicated On-Demand compute environment for now and revisit once interruption telemetry exists.",
      itemStatus: 'active',
    },
    resolution: "Release 02 routes STAT runs through a dedicated On-Demand Batch queue. Evaluate automatic fallback and predictive scaling separately in a future release after collecting interruption telemetry.",
    resolutionStatus: 'resolved',
    arc: 'arc_02',
  },
  {
    id: 'cmp_002',
    topic: "Pipeline Stage Bound to LIMS Specimen State",
    mode: 'instruction_vs_artifact',
    itemA: {
      entityId: 'PIPE-STAGE-001',
      entityLabel: "PIPE-STAGE-001",
      statement: "Every pipeline run inherits the stage of its controlling specimen-state record in LIMS, so a sequencing plate moves through Step Functions as one coherent workflow.",
      itemStatus: 'active',
    },
    itemB: {
      entityId: 'arc01_pass5',
      entityLabel: "Release 01 revision 5",
      statement: "Runs use a mix of stage bindings; some read specimen state from LIMS, others default to a hard-coded Step Functions entry point.",
      itemStatus: 'partially_superseded',
    },
    resolution: "Release 02 primary task: apply PIPE-STAGE-001 uniformly. Every run binds to its specimen-state record before Step Functions dispatch.",
    resolutionStatus: 'pending',
    arc: 'arc_02',
  },
  {
    id: 'cmp_003',
    topic: "Provenance Record Capture",
    mode: 'artifact_vs_exemplar',
    itemA: {
      entityId: 'arc01_pass5',
      entityLabel: "Release 01 revision 5",
      statement: "Provenance prefix corrected, but some Batch job outputs still lack a record of their input digests.",
      itemStatus: 'partially_superseded',
    },
    itemB: {
      entityId: 'exemplar_alignment',
      entityLabel: "Shared pipeline specification",
      statement: "Reference pipelines write a complete provenance record and CloudTrail audit trail for every step.",
      itemStatus: 'active',
    },
    resolution: "Add a lineage manifest per step. Every S3 object must link back to the job, image digest, and stage that produced it.",
    resolutionStatus: 'pending',
    arc: 'arc_02',
  },
  {
    id: 'cmp_004',
    topic: "VPC Containment of PHI Compute",
    mode: 'instruction_vs_artifact',
    itemA: {
      entityId: 'VPC-CONTAIN-001',
      entityLabel: "VPC-CONTAIN-001",
      statement: "PHI-linked compute must stay fully contained within the private VPC subnets of its region.",
      itemStatus: 'active',
    },
    itemB: {
      entityId: 'arc01_pass4',
      entityLabel: "Release 01 revision 4",
      statement: "SageMaker CNV endpoint exposed outside the VPC; EU annotation jobs reachable over cross-region peering.",
      itemStatus: 'superseded',
    },
    resolution: "Release 01 revision 5 partially resolved this. Release 02 narrows VPC endpoint policies and adds a Terraform policy check that fails any PHI-tagged resource outside private subnets.",
    resolutionStatus: 'resolved',
    arc: 'arc_02',
  },
  {
    id: 'cmp_005',
    topic: "Container Image References",
    mode: 'arc_vs_arc',
    itemA: {
      entityId: 'arc01_pass2',
      entityLabel: "Release 01 revision 2",
      statement: "Pipeline containers pulled by mutable tags (:latest, :v4). Validated runs could not be reproduced byte-for-byte.",
      itemStatus: 'superseded',
    },
    itemB: {
      entityId: 'arc01_pass5',
      entityLabel: "Release 01 revision 5",
      statement: "All Batch job definitions reference ECR image digests. Stable across revisions 4–5.",
      itemStatus: 'active',
    },
    resolution: "Release 02 retains the confirmed ECR image-digest policy for reproducible runs.",
    resolutionStatus: 'resolved',
    arc: 'arc_02',
  },
];

const DECISIONS: ReadonlyArray<Decision> = [
  {
    id: 'DEC-001',
    title: "Spot fallback deferred: STAT runs use a dedicated On-Demand queue",
    rationale: "The delivery update records that automatic Spot → On-Demand fallback can be reassessed later. A dedicated On-Demand compute environment for STAT orders meets turnaround today without interruption telemetry.",
    sourceIds: ['narrowing_file'],
    date: '2026-05-29',
    status: 'confirmed',
    arc: 'arc_02',
    category: 'operational',
  },
  {
    id: 'DEC-002',
    title: "Containers pinned by ECR digest: confirmed, no change needed",
    rationale: "The shared pipeline specification requires reproducible validated runs. Digest pinning has been stable since Release 01 revision 4, and the delivery update retains that decision.",
    sourceIds: ['exemplar_alignment', 'narrowing_file'],
    date: '2026-05-10',
    status: 'confirmed',
    arc: 'arc_02',
    category: 'operational',
  },
  {
    id: 'DEC-003',
    title: "Shared Terraform modules are now the only way to provision infrastructure",
    rationale: "The shared pipeline specification defines sample, run and analysis keys. One Terraform module set provisions every compute environment, addressing the configuration drift seen in Release 01 revisions 1–2.",
    sourceIds: ['exemplar_alignment', 'notion_fragment'],
    date: '2026-04-15',
    status: 'confirmed',
    arc: 'arc_01',
    category: 'operational',
  },
  {
    id: 'DEC-004',
    title: "Specimen state tiered into three levels: state of record, sub-state, flag",
    rationale: "The three-tier model lets LIMS communicate both magnitude and certainty of a specimen’s state. Pipelines read the state of record; flags route to QC review without blocking dispatch.",
    sourceIds: ['narrowing_file'],
    date: '2026-05-15',
    status: 'confirmed',
    arc: 'arc_01',
    category: 'scientific',
  },
  {
    id: 'DEC-005',
    title: "Regional KMS keys per geography",
    rationale: "Each geography gets its own customer-managed KMS key for S3 and EBS. Compliance can revoke access to one region’s genomic data without touching the others, which satisfies GDPR residency for EU specimens.",
    sourceIds: ['narrowing_file', 'notion_fragment'],
    date: '2026-05-29',
    status: 'confirmed',
    arc: 'arc_02',
    category: 'operational',
  },
  {
    id: 'DEC-006',
    title: "Runs bind to their LIMS specimen-state stage: Release 02 primary target",
    rationale: "The delivery update identifies stage binding as the primary stabilization target for Release 02. Every run reads its specimen-state record before Step Functions dispatch, removing hard-coded entry points.",
    sourceIds: ['narrowing_file'],
    date: '2026-05-29',
    status: 'confirmed',
    arc: 'arc_02',
    category: 'operational',
  },
  {
    id: 'DEC-007',
    title: "Predictive autoscaling deferred to a future capacity-planning release",
    rationale: "Scaling Batch compute from the LIMS run calendar needs stable queue priorities and instance sizing first. Deferring lets Release 02 focus on platform discipline.",
    sourceIds: ['narrowing_file'],
    date: '2026-05-29',
    status: 'confirmed',
    arc: 'future',
    category: 'operational',
  },
];

const GENERATION_PACKET: GenerationPacket = {
  arc: 'arc_02',
  arcLabel: 'Release 02 — Genomics platform',
  objective: 'Release 02 aligns pipeline stages with specimen state, contains PHI-linked compute within regional VPCs, and records S3 object lineage. Shared Terraform modules provision the platform. Future releases evaluate Spot fallback, multi-region failover and predictive autoscaling against their recorded prerequisites.',
  activeSources: ['notion_fragment', 'exemplar_alignment', 'reinforcing_surface', 'narrowing_file', 'arc01_pass5'],
  activeInstructions: [
    'PIPE-STAGE-001', 'BATCH-QUEUE-001', 'VPC-CONTAIN-001', 'EC2-RIGHTSIZE-001',
    'S3-LINEAGE-001', 'S3-PREFIX-001', 'IMG-PIN-001', 'PHI-SCOPE-001',
    'REF-GENOME-001', 'TF-MODULE-001', 'CLUSTER-SCALE-001', 'KMS-ENCRYPT-001',
  ],
  deferred: [
    'Spot → On-Demand fallback for STAT orders',
    'Multi-region active-active failover',
    'Cross-account Lake Formation sharing',
    'Predictive Batch autoscaling from LIMS calendar',
    'Contaminated-well adjacency expansion',
    'Plate/well proximity QC model',
    'EKS migration for annotation services',
  ],
  validationChecks: [
    'All pipelines resolve the pinned GRCh38 reference bundle',
    'Every container referenced by ECR digest, not tag',
    'No PHI-linked compute outside private VPC subnets',
    'All run steps emit a CloudTrail audit trail to their stage',
    'Pipeline stage matches LIMS specimen state for every run',
    'Job names, S3 keys, and log streams carry de-identified codes only',
    'All buckets and EBS volumes encrypted with regional CMKs',
    'All infrastructure provisioned from shared Terraform modules',
  ],
  readinessScore: 87,
};

const LANDMARKS: ReadonlyArray<Landmark> = [
  { id: 'lm_loam', name: 'Program priorities', role: 'AWS account constraints, delivery priorities, and operating runbooks.', sourceId: 'notion_fragment', iconName: 'Layers' },
  { id: 'lm_compass', name: 'The Shared Schema', role: 'Sample, run, and analysis keys are the shared schema. Every pipeline and Glue table derives from them.', sourceId: 'exemplar_alignment', iconName: 'Compass' },
  { id: 'lm_ruler', name: 'The Reference Bundle', role: 'One pinned GRCh38 reference bundle in S3. Every DRAGEN and GATK run resolves the same build.', sourceId: 'exemplar_alignment', iconName: 'Ruler' },
  { id: 'lm_drafting_key', name: 'The Terraform Modules', role: 'Network, Batch, storage, and IAM modules. Every compute environment and bucket is provisioned from them.', sourceId: 'arc01_pass5', iconName: 'BookOpen' },
  { id: 'lm_diligence', name: 'Quality controls', role: 'Plate controls, PhiX, unique dual indexes, and run metrics support sequencing quality review.', sourceId: 'notion_fragment', iconName: 'Shield' },
  { id: 'lm_reciprocal', name: 'Variant evidence', role: 'Variant reviewers connect genomic findings with cancer biology evidence.', sourceId: 'notion_fragment', iconName: 'ArrowLeftRight' },
  { id: 'lm_lineage', name: 'The Artifact Lineage', role: 'Pipeline releases over time: container digests, reference versions, validated runs.', sourceId: 'arc02_packet', iconName: 'GitBranch' },
];

// ------------------------------------------------------------
// Source relationship graph — the biopharma data platform.
//
// Nodes span the full genomic estate of a large organization:
// order intake & LIMS, sequencer fleets, S3 landing/processed
// buckets, AWS Batch / Step Functions pipelines, Glue + Lake
// Formation governance, curated reference knowledge bases, the
// interpretation/review committees, and the signed clinical
// deliverable. The original evidence-lineage cluster is
// preserved as the canonical evidence ledger at the base.
// ------------------------------------------------------------

const GRAPH_VIEW = { w: 1700, h: 1120 } as const;
const COL_W = 235;
const ROW_H = 118;
const MARGIN_X = 120;
const MARGIN_Y = 60;

type Role = GraphNode['role'];
type Cat = NonNullable<GraphNode['category']>;
type NodeSpec = {
  id: string; label: string; sublabel: string; col: number; row: number;
  role: Role; status: GraphNode['status']; category: Cat;
  system?: string; owner?: string; geo?: string; dataClass?: GraphNode['dataClass'];
  populations?: ReadonlyArray<string>; minWriteRole?: RoleId; description?: string;
  reviewState?: GraphNode['reviewState']; sampleState?: GraphNode['sampleState'];
  labState?: GraphNode['labState']; orderState?: GraphNode['orderState'];
};

const NODE_SPECS: ReadonlyArray<NodeSpec> = [
  // COL 0 — Orders & intake
  { id: 'ord_portal', label: 'Order Portal', sublabel: 'Test Requisition', col: 0, row: 0, role: 'loam_context', status: 'active', category: 'governance', system: 'API Gateway · Cognito', owner: 'Clinical Ops', geo: 'USE', dataClass: 'phi', orderState: 'placed', populations: ['executive', 'biopharma'], minWriteRole: 'lab_operator', description: 'Requisition intake for clinical and research orders. Each order carries protected outcome, consent scope, and residency regime before any specimen exists.' },
  { id: 'lims_us', label: 'LIMS · US', sublabel: 'Order Intake', col: 0, row: 1, role: 'visual_authority', status: 'active', category: 'instrument', system: 'LIMS · us-east-1', owner: 'Lab US', geo: 'USE', dataClass: 'phi', sampleState: 'received', labState: 'wet_lab', minWriteRole: 'lab_operator', description: 'US laboratory information management system. Owns accession identity, chain-of-custody, and specimen state for the US geography.' },
  { id: 'lims_eu', label: 'LIMS · EU', sublabel: 'Order Intake', col: 0, row: 2, role: 'visual_authority', status: 'active', category: 'instrument', system: 'LIMS · eu-west-1', owner: 'Lab EU', geo: 'EUW', dataClass: 'phi', sampleState: 'received', labState: 'wet_lab', minWriteRole: 'lab_operator', description: 'EU laboratory system under GDPR residency. Native identity, versions, and deletion semantics differ from US and are reconciled, never overwritten.' },
  { id: 'consent_reg', label: 'Consent Registry', sublabel: 'Governance', col: 0, row: 3, role: 'scientific_authority', status: 'active', category: 'governance', system: 'DynamoDB · global', owner: 'Compliance', geo: 'EUW', dataClass: 'phi', reviewState: 'approved', minWriteRole: 'auditor', description: 'Authoritative record of what each specimen may be used for. Gates every downstream projection; a population view may re-sequence depth but never widens consent.' },
  { id: 'specimen_acc', label: 'Specimen Accession', sublabel: 'Accessioning', col: 0, row: 4, role: 'latest_refinement', status: 'active', category: 'specimen', system: 'LIMS + S3', owner: 'Lab US', geo: 'USE', dataClass: 'limited', sampleState: 'accessioned', labState: 'wet_lab', minWriteRole: 'lab_operator', description: 'Point where an order becomes a tracked specimen: tube ID, chain-of-custody, and 96-well plate assignment. First materially legible object for the practitioner population.' },
  { id: 'phi_vault', label: 'PHI Linkage Vault', sublabel: 'Identity', col: 0, row: 5, role: 'context_only', status: 'stable', category: 'governance', system: 'S3 · SSE-KMS · VPC-only', owner: 'Compliance', geo: 'USE', dataClass: 'phi', minWriteRole: 'auditor', description: 'De-identification keys linking patient identity to specimen codes. Isolated so de-identified cohorts never carry re-identification risk to broader destinations.' },

  // COL 1 — Instruments & raw landing
  { id: 'novaseq_fleet', label: 'NovaSeq X Fleet', sublabel: 'Instruments', col: 1, row: 0, role: 'visual_authority', status: 'active', category: 'instrument', system: 'Illumina · on-prem', owner: 'Lab US', geo: 'USE', dataClass: 'de_identified', sampleState: 'sequenced', labState: 'wet_lab', minWriteRole: 'lab_operator', description: 'Primary sequencer fleet. Emits BCL to the raw landing bucket with run controls (PhiX spike, UDI balance) captured as run metadata.' },
  { id: 'nextseq', label: 'NextSeq 2000', sublabel: 'Instruments', col: 1, row: 1, role: 'visual_authority', status: 'active', category: 'instrument', system: 'Illumina · on-prem', owner: 'Lab EU', geo: 'EUW', dataClass: 'de_identified', sampleState: 'sequenced', labState: 'wet_lab', minWriteRole: 'lab_operator', description: 'Mid-throughput sequencer for expedited panels and rapid heme workflows.' },
  { id: 's3_bcl', label: 's3://…/bcl', sublabel: 'Raw BCL Landing', col: 1, row: 2, role: 'generation_distillation', status: 'active', category: 'infrastructure', system: 'S3 · SSE-KMS · versioned', owner: 'Platform', geo: 'USE', dataClass: 'de_identified', description: 'Immutable raw basecall landing zone. Versioned S3 objects with digest and metadata; a new run revision creates a new immutable snapshot.' },
  { id: 's3_fastq', label: 's3://…/fastq', sublabel: 'Demux FASTQ', col: 1, row: 3, role: 'generation_distillation', status: 'active', category: 'infrastructure', system: 'S3 · versioned', owner: 'Platform', geo: 'USE', dataClass: 'de_identified', description: 'Demultiplexed reads keyed by sample. Consumed by secondary analysis; lineage events may arrive delayed but converge without corrupting order.' },
  { id: 'run_meta_ddb', label: 'RunMeta Table', sublabel: 'Run Metadata', col: 1, row: 4, role: 'context_only', status: 'active', category: 'infrastructure', system: 'DynamoDB', owner: 'Platform', geo: 'USE', dataClass: 'synthetic', description: 'Instrument run receipts: cycles, Q30, cluster density, PhiX error rate. The technical auditor’s strongest runtime receipt.' },
  { id: 's3_manifest', label: 'Run Manifest', sublabel: 'Manifest', col: 1, row: 5, role: 'context_only', status: 'active', category: 'infrastructure', system: 'S3 · JSON', owner: 'Platform', geo: 'USE', dataClass: 'de_identified', description: 'Sample sheet + capture target manifest tying plate wells to library indices.' },

  // COL 2 — Pipelines (compute)
  { id: 'stepfn', label: 'Pipeline Orchestrator', sublabel: 'Step Functions', col: 2, row: 0, role: 'visual_authority', status: 'active', category: 'pipeline', system: 'AWS Step Functions', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', labState: 'dry_lab', orderState: 'in_progress', minWriteRole: 'arc_lead', description: 'State machine coordinating secondary analysis. Owns retries, partial-failure routing, and the recovery entry point the engineer population reconstructs.' },
  { id: 'dragen', label: 'DRAGEN Secondary', sublabel: 'Align + Call', col: 2, row: 1, role: 'visual_authority', status: 'active', category: 'pipeline', system: 'AWS Batch · F1 FPGA', owner: 'Bioinformatics', geo: 'USE', dataClass: 'de_identified', labState: 'dry_lab', orderState: 'in_progress', minWriteRole: 'analyst', description: 'Accelerated alignment and variant calling. Version-locked in VAL/PROD; a rule or reference-version change is a review trigger.' },
  { id: 'gatk', label: 'GATK Joint Geno', sublabel: 'Alt Pipeline', col: 2, row: 2, role: 'generated_artifact', status: 'active', category: 'pipeline', system: 'AWS Batch', owner: 'Bioinformatics', geo: 'USE', dataClass: 'de_identified', labState: 'dry_lab', minWriteRole: 'analyst', description: 'Cross-check pipeline for joint genotyping. Concordance with DRAGEN is an evidence signal, not a silent overwrite.' },
  { id: 'qc_pipe', label: 'QC / MultiQC', sublabel: 'QC Pipeline', col: 2, row: 3, role: 'generated_artifact', status: 'active', category: 'pipeline', system: 'AWS Batch', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', labState: 'dry_lab', reviewState: 'in_review', minWriteRole: 'analyst', description: 'Coverage, contamination, and off-target metrics. Gates promotion; observed value vs. missingness is exposed, not hidden.' },
  { id: 'vep', label: 'VEP Annotation', sublabel: 'Annotation', col: 2, row: 4, role: 'generated_artifact', status: 'active', category: 'pipeline', system: 'AWS Batch', owner: 'Bioinformatics', geo: 'USE', dataClass: 'de_identified', labState: 'dry_lab', minWriteRole: 'analyst', description: 'Functional consequence + HGVS normalization against a pinned reference version.' },
  { id: 'sagemaker', label: 'CNV / Fusion Model', sublabel: 'SageMaker', col: 2, row: 5, role: 'generated_artifact', status: 'exploratory', category: 'pipeline', system: 'SageMaker', owner: 'Data Science', geo: 'USW', dataClass: 'de_identified', labState: 'dry_lab', minWriteRole: 'analyst', description: 'Structural-variant inference with an explicit automation limit; low-confidence calls route to human review.' },

  // COL 3 — Processed data & catalog
  { id: 's3_bam', label: 's3://…/bam-cram', sublabel: 'Aligned Reads', col: 3, row: 0, role: 'generation_distillation', status: 'active', category: 'infrastructure', system: 'S3 · Intelligent-Tiering', owner: 'Platform', geo: 'USE', dataClass: 'limited', description: 'Aligned BAM/CRAM per sample. Digest-addressed; the provenance basis for every downstream variant claim.' },
  { id: 's3_vcf', label: 's3://…/vcf', sublabel: 'Variants VCF/gVCF', col: 3, row: 1, role: 'generation_distillation', status: 'active', category: 'infrastructure', system: 'S3 · versioned', owner: 'Platform', geo: 'USE', dataClass: 'limited', description: 'Called variants and joint gVCF. The scientist population traces which evidence produced each determination here.' },
  { id: 'glacier_cram', label: 'CRAM Cold Archive', sublabel: 'Retention', col: 3, row: 2, role: 'context_only', status: 'stable', category: 'infrastructure', system: 'S3 Glacier Deep', owner: 'Platform', geo: 'USE', dataClass: 'limited', description: 'Long-term retention for reproducibility. A deleted-object marker differs from lost permission and from missing content.' },
  { id: 'glue_catalog', label: 'Glue Data Catalog', sublabel: 'Schema Registry', col: 3, row: 3, role: 'context_only', status: 'active', category: 'infrastructure', system: 'AWS Glue', owner: 'Platform', geo: 'USE', dataClass: 'synthetic', description: 'Canonical schema for every processed dataset. Schema version is part of provenance and disclosure boundary.' },
  { id: 'lakeformation', label: 'Lake Formation', sublabel: 'Access Grants', col: 3, row: 4, role: 'scientific_authority', status: 'active', category: 'governance', system: 'Lake Formation', owner: 'Platform + Compliance', geo: 'USE', dataClass: 'limited', reviewState: 'approved', minWriteRole: 'admin', description: 'Row/column access grants across geographies. Narrow source content is never exported to a broader destination without approval.' },
  { id: 'athena', label: 'Athena Views', sublabel: 'Query Layer', col: 3, row: 5, role: 'generated_artifact', status: 'active', category: 'infrastructure', system: 'Athena', owner: 'Data Science', geo: 'USE', dataClass: 'de_identified', description: 'Governed query surface. Each view is a query coordinate the auditor can replay.' },
  { id: 'redshift', label: 'Redshift Warehouse', sublabel: 'Analytics', col: 3, row: 6, role: 'generated_artifact', status: 'active', category: 'infrastructure', system: 'Redshift', owner: 'Data Science', geo: 'USW', dataClass: 'de_identified', populations: ['researcher', 'executive'], description: 'Cohort analytics for researchers and executives — labor/delay effect, option value, and evidence-gap reporting.' },

  // COL 4 — Reference knowledge
  { id: 'ref_genome', label: 'GRCh38 + ALT', sublabel: 'Reference Genome', col: 4, row: 0, role: 'scientific_authority', status: 'stable', category: 'reference', system: 'S3 · public mirror', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', description: 'Pinned reference assembly. A reference-version bump is a named event that can reopen a decision.' },
  { id: 'clinvar', label: 'ClinVar Mirror', sublabel: 'Clinical DB', col: 4, row: 1, role: 'scientific_authority', status: 'active', category: 'reference', system: 'S3 · monthly', owner: 'Curation', geo: 'USE', dataClass: 'synthetic', reviewState: 'approved', description: 'Versioned clinical assertion mirror. Reference version is recorded with every classification it informs.' },
  { id: 'cosmic', label: 'COSMIC v99', sublabel: 'Somatic DB', col: 4, row: 2, role: 'scientific_authority', status: 'needs_fetch', category: 'reference', system: 'S3 · licensed', owner: 'Curation', geo: 'USE', dataClass: 'synthetic', description: 'Somatic mutation catalog. License-gated fetch; unavailability is explicit, not silently skipped.' },
  { id: 'oncokb', label: 'OncoKB', sublabel: 'Actionability', col: 4, row: 3, role: 'scientific_authority', status: 'active', category: 'reference', system: 'API · licensed', owner: 'Curation', geo: 'USE', dataClass: 'synthetic', description: 'Therapeutic actionability tiers feeding the tumor board and clinical report.' },
  { id: 'gnomad', label: 'gnomAD v4', sublabel: 'Population AF', col: 4, row: 4, role: 'scientific_authority', status: 'active', category: 'reference', system: 'S3 · public', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', populations: ['researcher'], description: 'Population allele frequencies used to downgrade common variants during classification.' },
  { id: 'pharmgkb', label: 'PharmGKB', sublabel: 'PGx Knowledge', col: 4, row: 5, role: 'scientific_authority', status: 'active', category: 'reference', system: 'API', owner: 'Curation', geo: 'USE', dataClass: 'synthetic', description: 'Pharmacogenomic evidence for germline reporting.' },

  // COL 5 — Interpretation & review
  { id: 'variant_review', label: 'Variant Review', sublabel: 'Interpretation', col: 5, row: 0, role: 'latest_refinement', status: 'active', category: 'governance', system: 'Review App', owner: 'Clinical Reviewers', geo: 'USE', dataClass: 'limited', reviewState: 'in_review', labState: 'interpretation', minWriteRole: 'reviewer', description: 'IGV-backed review of called variants. Separates source statement, model inference, and reviewed determination as distinct postures.' },
  { id: 'acmg', label: 'ACMG Classification', sublabel: 'Interpretation', col: 5, row: 1, role: 'latest_refinement', status: 'active', category: 'governance', system: 'Review App', owner: 'Clinical Reviewers', geo: 'USE', dataClass: 'limited', reviewState: 'changes_requested', labState: 'interpretation', minWriteRole: 'reviewer', description: 'Germline pathogenicity classification with rule + reference version recorded. Human override is explicit and reversible.' },
  { id: 'somatic_review', label: 'Somatic Review', sublabel: 'Interpretation', col: 5, row: 2, role: 'latest_refinement', status: 'active', category: 'governance', system: 'Review App', owner: 'Clinical Reviewers', geo: 'USE', dataClass: 'limited', reviewState: 'in_review', labState: 'interpretation', minWriteRole: 'reviewer', description: 'Tumor-only and tumor/normal somatic interpretation with COSMIC/OncoKB evidence.' },
  { id: 'germline_review', label: 'Germline Review', sublabel: 'Interpretation', col: 5, row: 3, role: 'latest_refinement', status: 'active', category: 'governance', system: 'Review App', owner: 'Clinical Reviewers', geo: 'EUW', dataClass: 'limited', reviewState: 'approved', labState: 'interpretation', minWriteRole: 'reviewer', description: 'Secondary-findings and PGx germline review under EU residency.' },
  { id: 'tumor_board', label: 'Molecular Tumor Board', sublabel: 'Governance', col: 5, row: 4, role: 'scientific_authority', status: 'active', category: 'governance', system: 'Scheduled', owner: 'MTB', geo: 'USE', dataClass: 'limited', reviewState: 'approved', labState: 'interpretation', minWriteRole: 'reviewer', description: 'Cross-disciplinary board reconciling molecular, pathology, and oncology evidence into an actionable determination.' },
  { id: 'msi_tmb', label: 'MSI / TMB', sublabel: 'Biomarkers', col: 5, row: 5, role: 'generated_artifact', status: 'active', category: 'pipeline', system: 'AWS Batch', owner: 'Bioinformatics', geo: 'USE', dataClass: 'de_identified', labState: 'dry_lab', minWriteRole: 'analyst', description: 'Microsatellite instability and tumor mutational burden biomarkers for immunotherapy actionability.' },

  // COL 6 — Deliverable & platform governance
  { id: 'clinical_report', label: 'Clinical Report', sublabel: 'Deliverable', col: 6, row: 0, role: 'generated_artifact', status: 'active', category: 'artifact', system: 'Report Service', owner: 'Sign-out', geo: 'USE', dataClass: 'phi', reviewState: 'signed_off', orderState: 'fulfilled', minWriteRole: 'reviewer', description: 'The signed patient-facing deliverable. Every claim traces back through review, evidence, and pipeline to a specimen and an order.' },
  { id: 'report_qc', label: 'Report QC', sublabel: 'Sign-out', col: 6, row: 1, role: 'generated_artifact', status: 'active', category: 'governance', system: 'Report Service', owner: 'Sign-out', geo: 'USE', dataClass: 'phi', reviewState: 'approved', minWriteRole: 'reviewer', description: 'Two-reviewer sign-out gate. Review and commitment are deliberately separated.' },
  { id: 'audit_ledger', label: 'Audit Ledger', sublabel: 'Immutable Trail', col: 6, row: 2, role: 'context_only', status: 'stable', category: 'governance', system: 'QLDB', owner: 'Compliance', geo: 'USE', dataClass: 'limited', minWriteRole: 'auditor', description: 'Cryptographically verifiable action history. The auditor’s locus for identity, provenance, and re-check dates.' },
  { id: 'kms_cmk', label: 'KMS CMK', sublabel: 'Encryption Root', col: 6, row: 3, role: 'context_only', status: 'stable', category: 'infrastructure', system: 'KMS', owner: 'Platform', geo: 'USE', dataClass: 'synthetic', minWriteRole: 'admin', description: 'Customer-managed key rooting envelope encryption for every specimen-bearing bucket.' },
  { id: 'iam_boundary', label: 'IAM Role Boundary', sublabel: 'Least Privilege', col: 6, row: 4, role: 'context_only', status: 'stable', category: 'governance', system: 'IAM', owner: 'Platform', geo: 'USE', dataClass: 'synthetic', minWriteRole: 'admin', description: 'Permission boundaries binding every principal’s effective access to role ceiling and environment.' },

  // BASE BAND — canonical evidence & generation cluster (original lineage, recast to AWS)
  { id: 'notion_fragment', label: 'Program brief', sublabel: 'Program context', col: 0, row: 8, role: 'loam_context', status: 'active', category: 'source', system: 'S3 · versioned docs', owner: 'Program', geo: 'USE', dataClass: 'synthetic', description: 'Versioned program brief in S3, recording platform constraints, operating runbooks, and release priorities.' },
  { id: 'yaml_context', label: 'Pipeline Config', sublabel: 'Release specification', col: 1, row: 8, role: 'generation_distillation', status: 'active', category: 'source', system: 'CodeCommit · YAML', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', description: 'Version-controlled pipeline configuration for workflow stages, compute queues, and reference bundles.' },
  { id: 'exemplar_alignment', label: 'Assay Design Spec', sublabel: 'Design specification', col: 2, row: 8, role: 'visual_authority', status: 'active', category: 'source', system: 'S3 · spec', owner: 'Assay Design', geo: 'USE', dataClass: 'synthetic', description: 'Authoritative pipeline schema for the workflow cartography — the shared Step Functions definition and common accession baseline.' },
  { id: 'narrowing_file', label: 'Platform delivery updates', sublabel: 'Delivery update', col: 3, row: 8, role: 'latest_refinement', status: 'active', category: 'source', system: 'S3 · upload', owner: 'Program', geo: 'USE', dataClass: 'synthetic', description: 'Latest platform decisions on stage alignment, private compute boundaries, and deferred work.' },
  { id: 'arc01_pass5', label: 'Release 01 Baseline', sublabel: 'Generated Artifact', col: 4, row: 8, role: 'generated_artifact', status: 'stable', category: 'artifact', system: 'S3 · artifact', owner: 'Program', geo: 'USE', dataClass: 'synthetic', description: 'Release 01 architecture baseline for reviewing pipeline and infrastructure changes in Release 02.' },
  { id: 'illumina_docs', label: 'Illumina / GATK Docs', sublabel: 'Scientific Authority', col: 5, row: 8, role: 'scientific_authority', status: 'needs_fetch', category: 'reference', system: 'Vendor docs', owner: 'Bioinformatics', geo: 'USE', dataClass: 'synthetic', description: 'Official sequencing + secondary-analysis documentation governing lane labels and terminology. Verify before use.' },
  { id: 'reinforcing_surface', label: 'Cohort Design Notes', sublabel: 'Context Only', col: 6, row: 7, role: 'context_only', status: 'active', category: 'source', system: 'S3 · notes', owner: 'Research', geo: 'USE', dataClass: 'synthetic', description: 'Sample volumes and assay mix inform capacity planning; approved specifications govern implementation.' },
  { id: 'arc02_packet', label: 'Release 02 plan', sublabel: 'Release specification', col: 3, row: 9, role: 'generation_distillation', status: 'active', category: 'governance', system: 'S3 + QLDB', owner: 'Program', geo: 'USE', dataClass: 'limited', description: 'Release plan linking approved sources, implementation requirements, and review checks for laboratory and platform teams.' },
];

const GRAPH_NODES: ReadonlyArray<GraphNode> = NODE_SPECS.map((s) => ({
  id: s.id,
  label: s.label,
  sublabel: s.sublabel,
  x: MARGIN_X + s.col * COL_W + 80,
  y: MARGIN_Y + s.row * ROW_H + 29,
  type: 'json_manifest',
  role: s.role,
  status: s.status,
  category: s.category,
  description: s.description,
  system: s.system,
  owner: s.owner,
  geographyCode: s.geo,
  dataClass: s.dataClass,
  populations: s.populations,
  minWriteRole: s.minWriteRole,
  reviewState: s.reviewState,
  sampleState: s.sampleState,
  labState: s.labState,
  orderState: s.orderState,
}));

const EDGE_COLOR: Record<GraphEdge['label'], string> = {
  governs: '#60a5fa',
  clarifies: '#a78bfa',
  condenses: '#2dd4bf',
  reinforces: '#818cf8',
  supersedes: '#fb7185',
  validates: '#34d399',
  informs: '#38bdf8',
  links: '#94a3b8',
  refines: '#f59e0b',
  reveals: '#a78bfa',
  derived_from: '#38bdf8',
};

type EdgeSpec = [from: string, to: string, label: GraphEdge['label']];
const EDGE_SPECS: ReadonlyArray<EdgeSpec> = [
  // intake → specimen
  ['ord_portal', 'lims_us', 'informs'], ['ord_portal', 'lims_eu', 'informs'],
  ['lims_us', 'specimen_acc', 'informs'], ['lims_eu', 'specimen_acc', 'informs'],
  ['consent_reg', 'specimen_acc', 'governs'], ['phi_vault', 'specimen_acc', 'links'],
  // specimen → instruments → raw
  ['specimen_acc', 'novaseq_fleet', 'informs'], ['specimen_acc', 'nextseq', 'informs'],
  ['specimen_acc', 's3_manifest', 'informs'],
  ['novaseq_fleet', 's3_bcl', 'condenses'], ['nextseq', 's3_bcl', 'condenses'],
  ['novaseq_fleet', 'run_meta_ddb', 'informs'], ['s3_bcl', 's3_fastq', 'refines'],
  // raw → pipelines
  ['s3_fastq', 'stepfn', 'informs'], ['s3_manifest', 'stepfn', 'informs'],
  ['stepfn', 'dragen', 'governs'], ['stepfn', 'gatk', 'governs'], ['stepfn', 'qc_pipe', 'governs'],
  ['ref_genome', 'dragen', 'governs'], ['ref_genome', 'gatk', 'governs'],
  // pipelines → processed
  ['dragen', 's3_bam', 'condenses'], ['dragen', 's3_vcf', 'condenses'],
  ['gatk', 's3_vcf', 'reinforces'], ['qc_pipe', 's3_vcf', 'validates'],
  ['s3_vcf', 'vep', 'refines'], ['sagemaker', 's3_vcf', 'informs'],
  ['s3_bam', 'msi_tmb', 'informs'], ['s3_bam', 'sagemaker', 'informs'],
  // processed → catalog / governance
  ['s3_bam', 'glacier_cram', 'condenses'], ['s3_bam', 'glue_catalog', 'informs'],
  ['s3_vcf', 'glue_catalog', 'informs'], ['glue_catalog', 'lakeformation', 'governs'],
  ['glue_catalog', 'athena', 'informs'], ['athena', 'redshift', 'informs'],
  ['lakeformation', 'athena', 'governs'], ['iam_boundary', 'lakeformation', 'governs'],
  ['kms_cmk', 's3_bcl', 'governs'], ['kms_cmk', 's3_bam', 'governs'],
  // → interpretation
  ['s3_vcf', 'variant_review', 'informs'], ['vep', 'variant_review', 'informs'],
  ['variant_review', 'acmg', 'refines'], ['clinvar', 'acmg', 'validates'], ['gnomad', 'acmg', 'validates'],
  ['variant_review', 'somatic_review', 'links'], ['variant_review', 'germline_review', 'links'],
  ['cosmic', 'somatic_review', 'validates'], ['oncokb', 'somatic_review', 'validates'],
  ['pharmgkb', 'germline_review', 'validates'], ['acmg', 'germline_review', 'informs'],
  // → board → report
  ['somatic_review', 'tumor_board', 'informs'], ['germline_review', 'tumor_board', 'informs'],
  ['msi_tmb', 'tumor_board', 'informs'], ['tumor_board', 'clinical_report', 'governs'],
  ['somatic_review', 'clinical_report', 'refines'], ['clinical_report', 'report_qc', 'informs'],
  ['report_qc', 'audit_ledger', 'informs'],
  // into the canonical evidence ledger (animated)
  ['clinical_report', 'arc02_packet', 'informs'], ['audit_ledger', 'arc02_packet', 'validates'],
  ['lakeformation', 'arc02_packet', 'governs'], ['variant_review', 'arc02_packet', 'refines'],
  ['glue_catalog', 'arc02_packet', 'condenses'],
  // original evidence cluster
  ['notion_fragment', 'yaml_context', 'condenses'], ['notion_fragment', 'arc02_packet', 'links'],
  ['exemplar_alignment', 'arc02_packet', 'governs'], ['narrowing_file', 'arc02_packet', 'refines'],
  ['arc01_pass5', 'arc02_packet', 'informs'], ['illumina_docs', 'arc02_packet', 'validates'],
  ['reinforcing_surface', 'arc02_packet', 'reinforces'], ['narrowing_file', 'arc01_pass5', 'clarifies'],
];

const GRAPH_EDGES: ReadonlyArray<GraphEdge> = EDGE_SPECS.map(([from, to, label], i) => ({
  id: `e${String(i + 1).padStart(2, '0')}`,
  from,
  to,
  label,
  color: EDGE_COLOR[label],
}));

// ============================================================
// Genomics workflow lanes — corridors of work
// ============================================================

// Pure flat palette inspired by the Julie Mésard exemplars — saturated yellows,
// oranges, blues, greens, beiges. No gradients on lane surfaces.
const LANES: ReadonlyArray<Lane> = [
  { id: 'lane_accession',      order: 0, label: 'Accession + Plate',     shortLabel: 'ACC',  color: '#e8d36a', accentColor: '#8a7a2a', stage: 'wet_lab',        description: 'Sample receipt, accessioning, 96-well plate map construction, chain-of-custody intake.' },
  { id: 'lane_extraction',     order: 1, label: 'Extraction + QC',       shortLabel: 'EXT',  color: '#e8b86a', accentColor: '#a07a2a', stage: 'wet_lab',        description: 'Nucleic acid extraction, concentration QC, integrity QC (TapeStation / Qubit).' },
  { id: 'lane_library',        order: 2, label: 'Library + Capture',     shortLabel: 'LIB',  color: '#d8854a', accentColor: '#8a4a1a', stage: 'wet_lab',        description: 'Library prep, hybrid capture / enrichment, UDI ligation, pooling.' },
  { id: 'lane_sequencer',      order: 3, label: 'Sequencer + RC',        shortLabel: 'SEQ',  color: '#5a8fbf', accentColor: '#2a4f7a', stage: 'wet_lab',        description: 'Run on NovaSeq / NextSeq, PhiX spike, run controls, basecalling. The picket-comb lane.' },
  { id: 'lane_secondary',      order: 4, label: 'Secondary Analysis',    shortLabel: 'SEC',  color: '#7aab6a', accentColor: '#3a6a2a', stage: 'dry_lab',        description: 'DRAGEN / GATK alignment, variant calling, joint genotyping.' },
  { id: 'lane_variant_review', order: 5, label: 'Variant Review',        shortLabel: 'VAR',  color: '#d8c89a', accentColor: '#8a7a4a', stage: 'interpretation', description: 'IGV review, somatic/germline review, ACMG classification.' },
  { id: 'lane_cancer_biology', order: 6, label: 'Cancer Biology',        shortLabel: 'CAN',  color: '#c87a7a', accentColor: '#7a3a3a', stage: 'interpretation', description: 'Tumor board, pathway interpretation, actionability annotation.' },
  { id: 'lane_reciprocal',     order: 7, label: 'Reciprocal Trace',      shortLabel: 'REC',  color: '#b8a8b8', accentColor: '#6a4a6a', stage: 'interpretation', description: 'Reciprocal cross-checks between Variant Review and Cancer Biology — meaning-making loop.' },
  // Corridors added from the LIMS build-vs-buy pilot: QA/result-release, reporting/sign-out, and LIS/HL7/FHIR interfacing are must-have domains that separate enterprise fit from open-source assembly.
  { id: 'lane_qa_release',     order: 8, label: 'QA + Result Release',   shortLabel: 'QA',   color: '#6fae8f', accentColor: '#2f6a4a', stage: 'interpretation', description: 'QA/QC review and controlled result release. Two-reviewer sign-off, deviations, CAPA — the Part 11 review-release corridor.' },
  { id: 'lane_reporting',      order: 9, label: 'Reporting + Sign-out',  shortLabel: 'RPT',  color: '#7a9ec8', accentColor: '#2a4a6a', stage: 'interpretation', description: 'Clinical report assembly, e-signature, amendment control, and delivery. The signed deliverable corridor.' },
  { id: 'lane_interfacing',    order: 10, label: 'LIS · HL7 / FHIR',     shortLabel: 'IF',   color: '#b58fc8', accentColor: '#5a3a6a', stage: 'dry_lab',        description: 'Enterprise interfacing: LIS/EHR, HL7 v2, FHIR R4, ASTM analyzer links. Interoperability spine across sites.' },
];

const LANE_CARDS: ReadonlyArray<LaneCard> = [
  // ACCESSION
  { id: 'lc_acc_intake',   laneId: 'lane_accession', kind: 'process',     label: 'Sample Intake',  position: 0.08, contaminationProb: 0.02,
    pennants: [{ kind: 'qc', label: 'CoC' }],
    nested: [{ id: 'n_acc_tube', label: 'Tube ID' }, { id: 'n_acc_chain', label: 'Chain' }],
    crossRefs: { sourceIds: ['notion_fragment'], instructionIds: ['PHI-SCOPE-001'] } },
  { id: 'lc_acc_platemap', laneId: 'lane_accession', kind: 'state_major', label: 'Plate Map 96',  position: 0.30, contaminationProb: 0.05,
    nested: [{ id: 'n_acc_pos', label: 'POS A1', color: '#34d399' }, { id: 'n_acc_neg', label: 'NEG H12', color: '#f87171' }],
    crossRefs: { artifactIds: ['arc02_pass1'] } },
  { id: 'lc_acc_state',    laneId: 'lane_accession', kind: 'control',     label: 'PhiX Lot',       position: 0.52, contaminationProb: 0.01 },
  { id: 'lc_acc_qc',       laneId: 'lane_accession', kind: 'process',     label: 'CoC Verify',     position: 0.70, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },
  { id: 'lc_acc_flag',     laneId: 'lane_accession', kind: 'state_minor', label: 'Re-accession',   position: 0.88, contaminationProb: 0.18,
    pennants: [{ kind: 'spe', label: 'Spé.' }],
    note: 'Mis-labeled tube flagged',
    crossRefs: { comparisonIds: ['cmp_004'] } },

  // EXTRACTION
  { id: 'lc_ext_extract',  laneId: 'lane_extraction', kind: 'process',     label: 'NA Extract',     position: 0.10, contaminationProb: 0.08,
    pennants: [{ kind: 'per', label: 'PER' }] },
  { id: 'lc_ext_qubit',    laneId: 'lane_extraction', kind: 'process',     label: 'Qubit',          position: 0.26, contaminationProb: 0.02 },
  { id: 'lc_ext_tape',     laneId: 'lane_extraction', kind: 'process',     label: 'TapeStation',    position: 0.40, contaminationProb: 0.02 },
  { id: 'lc_ext_state',    laneId: 'lane_extraction', kind: 'state_major', label: 'DIN 7.4 · QC',   position: 0.58, contaminationProb: 0.04,
    nested: [{ id: 'n_ext_din', label: 'DIN' }, { id: 'n_ext_yield', label: 'ng/µL' }],
    crossRefs: { instructionIds: ['CLUSTER-SCALE-001'] } },
  { id: 'lc_ext_dna',      laneId: 'lane_extraction', kind: 'process',     label: 'Yield Log',      position: 0.78, streamRef: 'st_qcmetrics', contaminationProb: 0.0 },
  { id: 'lc_ext_flag',     laneId: 'lane_extraction', kind: 'state_minor', label: 'Re-extract',     position: 0.92, contaminationProb: 0.20,
    pennants: [{ kind: 'spe', label: 'Spé.' }] },

  // LIBRARY + CAPTURE
  { id: 'lc_lib_frag',     laneId: 'lane_library', kind: 'process',     label: 'Frag.',           position: 0.08, contaminationProb: 0.06 },
  { id: 'lc_lib_lig',      laneId: 'lane_library', kind: 'process',     label: 'UDI Ligate',      position: 0.22, contaminationProb: 0.05,
    pennants: [{ kind: 'per', label: 'PER' }],
    nested: [{ id: 'n_lib_udi1', label: 'UDI-A' }, { id: 'n_lib_udi2', label: 'UDI-B' }] },
  { id: 'lc_lib_capture',  laneId: 'lane_library', kind: 'state_major', label: 'Hybrid Capture',  position: 0.42, contaminationProb: 0.07,
    note: 'Twist exome panel',
    crossRefs: { sourceIds: ['exemplar_alignment'] } },
  { id: 'lc_lib_pool',     laneId: 'lane_library', kind: 'process',     label: 'Pool',            position: 0.62, contaminationProb: 0.04 },
  { id: 'lc_lib_norm',     laneId: 'lane_library', kind: 'process',     label: 'Normalize',       position: 0.74, contaminationProb: 0.02 },
  { id: 'lc_lib_flag',     laneId: 'lane_library', kind: 'state_minor', label: 'Adapter Dimer',   position: 0.90, contaminationProb: 0.16,
    pennants: [{ kind: 'spe', label: 'Spé.' }] },

  // SEQUENCER — picket-comb lane
  { id: 'lc_seq_load',     laneId: 'lane_sequencer', kind: 'process',     label: 'Load',           position: 0.06, contaminationProb: 0.01 },
  { id: 'lc_seq_phix',     laneId: 'lane_sequencer', kind: 'control',     label: 'PhiX Spike',     position: 0.18, contaminationProb: 0.0,
    pennants: [{ kind: 'qc', label: 'QC' }] },
  { id: 'lc_seq_run',      laneId: 'lane_sequencer', kind: 'state_major', label: 'NovaSeq X',      position: 0.36, contaminationProb: 0.0,
    nested: [{ id: 'n_seq_r1', label: 'R1·150' }, { id: 'n_seq_r2', label: 'R2·150' }, { id: 'n_seq_i', label: 'i7·10' }],
    crossRefs: { artifactIds: ['arc02_pass1'] } },
  { id: 'lc_seq_basecall', laneId: 'lane_sequencer', kind: 'process',     label: 'Basecall',       position: 0.58, streamRef: 'st_bcl', contaminationProb: 0.0 },
  { id: 'lc_seq_demux',    laneId: 'lane_sequencer', kind: 'process',     label: 'Demux',          position: 0.72, streamRef: 'st_fastq', contaminationProb: 0.0 },
  { id: 'lc_seq_q30',      laneId: 'lane_sequencer', kind: 'state_minor', label: 'Q30 ≥ 90',       position: 0.86, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },
  { id: 'lc_seq_flag',     laneId: 'lane_sequencer', kind: 'state_minor', label: 'Lane Imbalance', position: 0.96, contaminationProb: 0.10,
    pennants: [{ kind: 'spe', label: 'Spé.' }] },

  // SECONDARY
  { id: 'lc_sec_align',    laneId: 'lane_secondary', kind: 'process',     label: 'DRAGEN Align',  position: 0.10, streamRef: 'st_bam', contaminationProb: 0.0 },
  { id: 'lc_sec_dedup',    laneId: 'lane_secondary', kind: 'process',     label: 'Dedup',         position: 0.26, contaminationProb: 0.0 },
  { id: 'lc_sec_call',     laneId: 'lane_secondary', kind: 'state_major', label: 'Variant Call',  position: 0.46, streamRef: 'st_vcf', contaminationProb: 0.0,
    nested: [{ id: 'n_sec_snv', label: 'SNV' }, { id: 'n_sec_indel', label: 'Indel' }, { id: 'n_sec_cnv', label: 'CNV' }],
    crossRefs: { artifactIds: ['arc02_pass1'], instructionIds: ['TF-MODULE-001'] } },
  { id: 'lc_sec_joint',    laneId: 'lane_secondary', kind: 'process',     label: 'Joint Geno',    position: 0.66, streamRef: 'st_gvcf', contaminationProb: 0.0 },
  { id: 'lc_sec_anno',     laneId: 'lane_secondary', kind: 'process',     label: 'Annotate',      position: 0.80, contaminationProb: 0.0,
    pennants: [{ kind: 'drean', label: 'Drean' }] },
  { id: 'lc_sec_flag',     laneId: 'lane_secondary', kind: 'state_minor', label: 'Off-target ↑', position: 0.94, contaminationProb: 0.04 },

  // VARIANT REVIEW
  { id: 'lc_var_filter',   laneId: 'lane_variant_review', kind: 'process',     label: 'PASS Filter',  position: 0.12, contaminationProb: 0.0 },
  { id: 'lc_var_igv',      laneId: 'lane_variant_review', kind: 'process',     label: 'IGV Locus',    position: 0.30, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },
  { id: 'lc_var_acmg',     laneId: 'lane_variant_review', kind: 'state_major', label: 'ACMG Class',   position: 0.50, contaminationProb: 0.0,
    nested: [{ id: 'n_var_p', label: 'P' }, { id: 'n_var_lp', label: 'LP' }, { id: 'n_var_vus', label: 'VUS' }, { id: 'n_var_lb', label: 'LB' }],
    crossRefs: { decisionIds: ['DEC-004'] } },
  { id: 'lc_var_clinvar',  laneId: 'lane_variant_review', kind: 'process',     label: 'ClinVar',      position: 0.68, contaminationProb: 0.0 },
  { id: 'lc_var_flag',     laneId: 'lane_variant_review', kind: 'state_minor', label: 'VUS Conflict', position: 0.84, contaminationProb: 0.0,
    pennants: [{ kind: 'spe', label: 'Spé.' }],
    crossRefs: { comparisonIds: ['cmp_002'] } },

  // CANCER BIOLOGY
  { id: 'lc_can_path',     laneId: 'lane_cancer_biology', kind: 'process',     label: 'Pathway Map',  position: 0.14, contaminationProb: 0.0 },
  { id: 'lc_can_onco',     laneId: 'lane_cancer_biology', kind: 'process',     label: 'OncoKB',       position: 0.32, contaminationProb: 0.0 },
  { id: 'lc_can_cosmic',   laneId: 'lane_cancer_biology', kind: 'process',     label: 'COSMIC',       position: 0.46, contaminationProb: 0.0 },
  { id: 'lc_can_board',    laneId: 'lane_cancer_biology', kind: 'state_major', label: 'Tumor Board',  position: 0.62, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }],
    nested: [{ id: 'n_can_mol', label: 'Mol' }, { id: 'n_can_path', label: 'Path' }, { id: 'n_can_onc', label: 'Onc' }] },
  { id: 'lc_can_action',   laneId: 'lane_cancer_biology', kind: 'state_minor', label: 'Actionable',   position: 0.82, contaminationProb: 0.0,
    crossRefs: { decisionIds: ['DEC-006'] } },

  // RECIPROCAL TRACE
  { id: 'lc_rec_cross',    laneId: 'lane_reciprocal', kind: 'process',     label: 'Cross Check',     position: 0.28, contaminationProb: 0.0 },
  { id: 'lc_rec_loop',     laneId: 'lane_reciprocal', kind: 'state_major', label: 'Meaning Loop',    position: 0.54, contaminationProb: 0.0,
    nested: [{ id: 'n_rec_bx', label: 'Bx' }, { id: 'n_rec_ihc', label: 'IHC' }] },
  { id: 'lc_rec_flag',     laneId: 'lane_reciprocal', kind: 'state_minor', label: 'Discordance',     position: 0.78, contaminationProb: 0.0,
    pennants: [{ kind: 'spe', label: 'Spé.' }] },

  // ===== ADDITIONAL CARDS (filling doubled lane length, from exemplar SVG vocabulary) =====
  // ACCESSION
  { id: 'lc_acc_udi',     laneId: 'lane_accession',     kind: 'process',     label: 'UDI Plate',      position: 0.42, contaminationProb: 0.01,
    nested: [{ id: 'n_acc_a', label: 'A1·H12' }] },
  { id: 'lc_acc_block',   laneId: 'lane_accession',     kind: 'process',     label: 'Tumor Block',    position: 0.18, contaminationProb: 0.03,
    pennants: [{ kind: 'qc', label: 'FFPE' }] },
  // EXTRACTION
  { id: 'lc_ext_ffpe',    laneId: 'lane_extraction',    kind: 'process',     label: 'FFPE Macrodissect', position: 0.04, contaminationProb: 0.06 },
  { id: 'lc_ext_din',     laneId: 'lane_extraction',    kind: 'control',     label: 'DIN Gate',       position: 0.50, contaminationProb: 0.0,
    pennants: [{ kind: 'qc', label: 'QC' }] },
  // LIBRARY
  { id: 'lc_lib_tagm',    laneId: 'lane_library',       kind: 'process',     label: 'Tagmentation',   position: 0.30, contaminationProb: 0.05 },
  { id: 'lc_lib_target',  laneId: 'lane_library',       kind: 'state_minor', label: 'Target Panel',   position: 0.54, contaminationProb: 0.02,
    nested: [{ id: 'n_lib_genes', label: '523 genes' }] },
  { id: 'lc_lib_molar',   laneId: 'lane_library',       kind: 'control',     label: 'Molarity',       position: 0.82, contaminationProb: 0.0 },
  // SEQUENCER
  { id: 'lc_seq_flow',    laneId: 'lane_sequencer',     kind: 'process',     label: 'Flow Cell',      position: 0.26, contaminationProb: 0.0,
    pennants: [{ kind: 'per', label: 'PER' }] },
  { id: 'lc_seq_xleap',   laneId: 'lane_sequencer',     kind: 'state_minor', label: 'XLEAP-SBS',      position: 0.48, contaminationProb: 0.0 },
  // SECONDARY
  { id: 'lc_sec_coverage', laneId: 'lane_secondary',    kind: 'control',     label: 'Coverage Gate',  position: 0.36, contaminationProb: 0.0,
    pennants: [{ kind: 'qc', label: 'QC' }] },
  { id: 'lc_sec_fusion',  laneId: 'lane_secondary',     kind: 'process',     label: 'CNV/Fusion',     position: 0.56, contaminationProb: 0.0 },
  // VARIANT REVIEW
  { id: 'lc_var_hgvs',    laneId: 'lane_variant_review', kind: 'process',    label: 'HGVS Notate',    position: 0.42, contaminationProb: 0.0 },
  { id: 'lc_var_pileup',  laneId: 'lane_variant_review', kind: 'process',    label: 'Pileup Verify',  position: 0.60, contaminationProb: 0.0 },
  // CANCER BIOLOGY
  { id: 'lc_can_driver',  laneId: 'lane_cancer_biology', kind: 'process',    label: 'Driver Genes',   position: 0.22, contaminationProb: 0.0,
    nested: [{ id: 'n_can_tp53', label: 'TP53' }, { id: 'n_can_kras', label: 'KRAS' }] },
  { id: 'lc_can_evidence', laneId: 'lane_cancer_biology', kind: 'state_minor', label: 'Evidence Gen', position: 0.54, contaminationProb: 0.0 },
  { id: 'lc_can_report',  laneId: 'lane_cancer_biology', kind: 'process',    label: 'Report Draft',   position: 0.92, contaminationProb: 0.0,
    pennants: [{ kind: 'drean', label: 'Drean' }] },
  // RECIPROCAL
  { id: 'lc_rec_memory',  laneId: 'lane_reciprocal',     kind: 'process',    label: 'Memory Edge',    position: 0.10, contaminationProb: 0.0 },
  { id: 'lc_rec_chain',   laneId: 'lane_reciprocal',     kind: 'control',    label: 'Chain Note',     position: 0.92, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },

  // ===== QA + RESULT RELEASE (from LIMS pilot: two-reviewer sign-off, deviations, CAPA, Part 11) =====
  { id: 'lc_qa_intake',   laneId: 'lane_qa_release', kind: 'process',     label: 'QC Queue',       position: 0.08, contaminationProb: 0.0,
    nested: [{ id: 'n_qa_wet', label: 'Wet' }, { id: 'n_qa_dry', label: 'Dry' }] },
  { id: 'lc_qa_review1',  laneId: 'lane_qa_release', kind: 'process',     label: 'Reviewer 1',     position: 0.24, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },
  { id: 'lc_qa_review2',  laneId: 'lane_qa_release', kind: 'state_major', label: 'Two-Person Sign-off', position: 0.44, contaminationProb: 0.0,
    note: 'Part 11 e-signature · dual control',
    nested: [{ id: 'n_qa_r1', label: 'R1 ✓' }, { id: 'n_qa_r2', label: 'R2 ○' }],
    crossRefs: { decisionIds: ['DEC-004'] } },
  { id: 'lc_qa_deviation', laneId: 'lane_qa_release', kind: 'state_minor', label: 'Deviation / CAPA', position: 0.64, contaminationProb: 0.12,
    pennants: [{ kind: 'spe', label: 'Spé.' }],
    note: 'Open deviation blocks release' },
  { id: 'lc_qa_release',  laneId: 'lane_qa_release', kind: 'control',     label: 'Release Gate',   position: 0.84, contaminationProb: 0.0,
    pennants: [{ kind: 'qc', label: 'GxP' }] },

  // ===== REPORTING + SIGN-OUT =====
  { id: 'lc_rpt_assemble', laneId: 'lane_reporting', kind: 'process',     label: 'Assemble Report', position: 0.12, contaminationProb: 0.0 },
  { id: 'lc_rpt_narrative', laneId: 'lane_reporting', kind: 'process',    label: 'Clinical Narrative', position: 0.30, contaminationProb: 0.0,
    pennants: [{ kind: 'drean', label: 'Drean' }] },
  { id: 'lc_rpt_signout', laneId: 'lane_reporting', kind: 'state_major',  label: 'Director Sign-out', position: 0.52, contaminationProb: 0.0,
    note: 'CLIA lab director e-signature',
    nested: [{ id: 'n_rpt_esig', label: 'e-sig' }, { id: 'n_rpt_ver', label: 'v1.0' }] },
  { id: 'lc_rpt_amend',   laneId: 'lane_reporting', kind: 'state_minor',  label: 'Amendment Ctrl', position: 0.72, contaminationProb: 0.0,
    pennants: [{ kind: 'review', label: 'rev' }] },
  { id: 'lc_rpt_deliver', laneId: 'lane_reporting', kind: 'control',      label: 'Deliver PDF/FHIR', position: 0.90, contaminationProb: 0.0 },

  // ===== LIS · HL7 / FHIR INTERFACING =====
  { id: 'lc_if_lis',      laneId: 'lane_interfacing', kind: 'process',    label: 'LIS Inbound',    position: 0.10, contaminationProb: 0.0,
    nested: [{ id: 'n_if_order', label: 'ORM' }] },
  { id: 'lc_if_hl7',      laneId: 'lane_interfacing', kind: 'process',    label: 'HL7 v2 Map',     position: 0.30, contaminationProb: 0.03,
    pennants: [{ kind: 'per', label: 'PER' }] },
  { id: 'lc_if_fhir',     laneId: 'lane_interfacing', kind: 'state_major', label: 'FHIR R4 Bundle', position: 0.52, contaminationProb: 0.0,
    note: 'DiagnosticReport + Observation',
    nested: [{ id: 'n_if_dr', label: 'DR' }, { id: 'n_if_obs', label: 'Obs' }, { id: 'n_if_spec', label: 'Spec' }] },
  { id: 'lc_if_astm',     laneId: 'lane_interfacing', kind: 'process',    label: 'ASTM Analyzer',  position: 0.72, contaminationProb: 0.02 },
  { id: 'lc_if_consent',  laneId: 'lane_interfacing', kind: 'state_minor', label: 'Consent Feed',   position: 0.90, contaminationProb: 0.08,
    pennants: [{ kind: 'spe', label: 'Spé.' }],
    note: 'Consent Registry → propagates holds' },
];

// Flags planted along the lanes (between cards) — milestones, gates, handoffs
const LANE_FLAGS: ReadonlyArray<LaneFlag> = [
  { id: 'lf_acc_start',   laneId: 'lane_accession',     position: 0.02, kind: 'checkered', label: 'START',     sublabel: 'Specimen' },
  { id: 'lf_acc_handoff', laneId: 'lane_accession',     position: 0.98, kind: 'handoff',   label: 'HANDOFF',   sublabel: '→ Extraction' },
  { id: 'lf_ext_gate',    laneId: 'lane_extraction',    position: 0.62, kind: 'gate',      label: 'GATE',      sublabel: 'DIN ≥ 7' },
  { id: 'lf_lib_milestone', laneId: 'lane_library',     position: 0.48, kind: 'milestone', label: 'MILESTONE', sublabel: 'Capture' },
  { id: 'lf_seq_caution', laneId: 'lane_sequencer',     position: 0.92, kind: 'caution',   label: 'CAUTION',   sublabel: 'Imbalance' },
  { id: 'lf_seq_finish',  laneId: 'lane_sequencer',     position: 0.99, kind: 'checkered', label: 'FINISH',    sublabel: 'BCL ready' },
  { id: 'lf_sec_gate',    laneId: 'lane_secondary',     position: 0.40, kind: 'gate',      label: 'GATE',      sublabel: 'Cov ≥ 200×' },
  { id: 'lf_var_handoff', laneId: 'lane_variant_review', position: 0.96, kind: 'handoff',  label: 'HANDOFF',   sublabel: '→ Tumor Bd' },
  { id: 'lf_can_finish',  laneId: 'lane_cancer_biology', position: 0.99, kind: 'checkered', label: 'REPORT',   sublabel: 'Defensible' },
  { id: 'lf_qa_gate',     laneId: 'lane_qa_release',     position: 0.40, kind: 'gate',      label: 'GATE',      sublabel: '2-person' },
  { id: 'lf_qa_release',  laneId: 'lane_qa_release',     position: 0.99, kind: 'checkered', label: 'RELEASED',  sublabel: 'GxP' },
  { id: 'lf_rpt_milestone', laneId: 'lane_reporting',    position: 0.50, kind: 'milestone', label: 'SIGN-OUT',  sublabel: 'Director' },
  { id: 'lf_rpt_deliver', laneId: 'lane_reporting',      position: 0.99, kind: 'handoff',   label: 'DELIVER',   sublabel: '→ EHR' },
  { id: 'lf_if_caution',  laneId: 'lane_interfacing',    position: 0.88, kind: 'caution',   label: 'HOLD',      sublabel: 'Consent' },
];

// Labels printed directly on the lane surfaces between cards
const LANE_SURFACE_LABELS: ReadonlyArray<LaneSurfaceLabel> = [
  { id: 'lsl_acc_a', laneId: 'lane_accession',     position: 0.55, text: 'identity + chain' },
  { id: 'lsl_ext_a', laneId: 'lane_extraction',    position: 0.34, text: 'ng/µL · DIN' },
  { id: 'lsl_lib_a', laneId: 'lane_library',       position: 0.70, text: 'pool balance' },
  { id: 'lsl_seq_a', laneId: 'lane_sequencer',     position: 0.42, text: 'cycles · base-call' },
  { id: 'lsl_sec_a', laneId: 'lane_secondary',     position: 0.74, text: 'align · call · annotate' },
  { id: 'lsl_var_a', laneId: 'lane_variant_review', position: 0.74, text: 'meaning + pathway' },
  { id: 'lsl_can_a', laneId: 'lane_cancer_biology', position: 0.74, text: 'evidence · oncogenic' },
  { id: 'lsl_rec_a', laneId: 'lane_reciprocal',     position: 0.40, text: 'review ↔ biology', tone: 'warn' },
  { id: 'lsl_qa_a',  laneId: 'lane_qa_release',     position: 0.72, text: 'dual control · CAPA' },
  { id: 'lsl_rpt_a', laneId: 'lane_reporting',      position: 0.40, text: 'e-signature · amend' },
  { id: 'lsl_if_a',  laneId: 'lane_interfacing',    position: 0.42, text: 'HL7 · FHIR · ASTM' },
];

// Curved flow arrows between cards
const LANE_ARROWS: ReadonlyArray<LaneArrow> = [
  { id: 'ar_acc_to_ext', fromCardId: 'lc_acc_qc',     toCardId: 'lc_ext_extract', kind: 'flow' },
  { id: 'ar_ext_to_lib', fromCardId: 'lc_ext_dna',    toCardId: 'lc_lib_frag',    kind: 'flow' },
  { id: 'ar_lib_to_seq', fromCardId: 'lc_lib_pool',   toCardId: 'lc_seq_load',    kind: 'flow' },
  { id: 'ar_seq_to_sec', fromCardId: 'lc_seq_demux',  toCardId: 'lc_sec_align',   kind: 'flow' },
  { id: 'ar_sec_to_var', fromCardId: 'lc_sec_call',   toCardId: 'lc_var_filter',  kind: 'flow' },
  { id: 'ar_var_to_can', fromCardId: 'lc_var_acmg',   toCardId: 'lc_can_onco',    kind: 'flow' },
  { id: 'ar_var_to_rec', fromCardId: 'lc_var_flag',   toCardId: 'lc_rec_cross',   kind: 'reciprocal' },
  { id: 'ar_can_to_rec', fromCardId: 'lc_can_action', toCardId: 'lc_rec_loop',    kind: 'reciprocal' },
  { id: 'ar_rec_to_var', fromCardId: 'lc_rec_flag',   toCardId: 'lc_var_acmg',    kind: 'reciprocal' },
  { id: 'ar_lib_flag',   fromCardId: 'lc_lib_flag',   toCardId: 'lc_ext_flag',    kind: 'deferred' },
  { id: 'ar_review_seq', fromCardId: 'lc_var_igv',    toCardId: 'lc_seq_q30',     kind: 'review' },
  { id: 'ar_can_to_qa',  fromCardId: 'lc_can_report', toCardId: 'lc_qa_intake',   kind: 'flow' },
  { id: 'ar_qa_to_rpt',  fromCardId: 'lc_qa_release', toCardId: 'lc_rpt_assemble', kind: 'flow' },
  { id: 'ar_rpt_to_if',  fromCardId: 'lc_rpt_deliver', toCardId: 'lc_if_fhir',    kind: 'flow' },
  { id: 'ar_if_consent', fromCardId: 'lc_if_consent', toCardId: 'lc_qa_deviation', kind: 'review' },
];

// 96-well sample plate (8 rows A–H × 12 cols 1–12). Wells holding a
// registered specimen take their identity (accession, assay, patient,
// priority, tumor %) from the Specimen Registry so the plate, the
// registry and the result stacks all describe the same aliquot.
function buildPlate(specimens: ReadonlyArray<Specimen>): ReadonlyArray<Well> {
  const wells: Well[] = [];
  // PCR-style hotspot near columns 4–6, rows C–E (simulated cross-contamination event)
  const hotR = 3, hotC = 5;
  const ASSAYS: ReadonlyArray<SampleAssay> = ['wgs', 'wes', 'panel_solid', 'panel_heme', 'rna_seq', 'methylation'];
  const PRIORITIES: ReadonlyArray<SamplePriority> = ['routine', 'routine', 'routine', 'expedited', 'stat'];
  // deterministic pseudo-random
  function prand(seed: number): number {
    const x = Math.sin(seed * 9999.31) * 43758.5453;
    return x - Math.floor(x);
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 12; c++) {
      const idx = r * 12 + c;
      let role: WellRole = 'sample';
      if (r === 0 && c === 0) role = 'positive_control';
      else if (r === 7 && c === 11) role = 'negative_control';
      else if ((r + c) % 23 === 0) role = 'empty';
      const dist = Math.max(Math.abs(r - hotR), Math.abs(c - hotC));
      const base = role === 'negative_control' ? 0.04 : role === 'positive_control' ? 0.02 : 0.05;
      const contamination = role === 'empty' ? 0 : Math.min(0.95, base + Math.max(0, 0.55 - dist * 0.12));
      const sampleId = role === 'sample' ? `S${String(idx + 1).padStart(3, '0')}`
        : role === 'positive_control' ? 'CTRL-POS'
        : role === 'negative_control' ? 'CTRL-NEG'
        : undefined;
      const isSample = role === 'sample';
      // Consent posture is propagated in from the Consent Registry, owned by
      // the Clinical Governance department. Well E3 (row 4, col 2) carries a
      // patient who has RESCINDED consent for data analysis — the platform
      // must hold that specimen. A couple of others are pending re-consent.
      const isRescinded = isSample && r === 4 && c === 2;
      const isPending = isSample && !isRescinded && (idx === 17 || idx === 62);
      const consentStatus = !isSample
        ? undefined
        : isRescinded ? 'rescinded' : isPending ? 'pending' : 'active';
      const generated: Well = {
        row: r, col: c, role, sampleId, contaminationProb: isRescinded ? 0.03 : contamination,
        assay: isSample ? ASSAYS[Math.floor(prand(idx + 1) * ASSAYS.length)] : undefined,
        priority: isSample ? PRIORITIES[Math.floor(prand(idx + 2) * PRIORITIES.length)] : undefined,
        patientCode: isSample ? `PT-${String(2000 + Math.floor(prand(idx + 3) * 800)).padStart(4, '0')}` : undefined,
        tumorPercent: isSample ? Math.floor(15 + prand(idx + 4) * 75) : undefined,
        volumeUl: isSample ? Math.round((10 + prand(idx + 5) * 40) * 10) / 10 : undefined,
        concentrationNgUl: isSample ? Math.round((4 + prand(idx + 6) * 80) * 10) / 10 : undefined,
        dinScore: isSample ? Math.round((5 + prand(idx + 7) * 4.5) * 10) / 10 : undefined,
        accessionedAt: '2026-05-29',
        consentStatus,
        consentSetBy: isSample ? 'Clinical Governance · Consent Registry' : undefined,
        consentUpdatedAt: isRescinded ? '2026-06-07' : isPending ? '2026-06-02' : isSample ? '2026-05-28' : undefined,
        note: isRescinded
          ? 'CONSENT RESCINDED — analysis held; propagated from Consent Registry'
          : isPending
          ? 'Consent pending re-verification — do not release'
          : contamination > 0.5 ? 'Adjacent hotspot — re-prep recommended' : undefined,
      };
      const wellId = wellIdOf(r, c);
      const spx = isSample ? specimens.find((s) => s.plateWell === wellId) : undefined;
      const w: Well = spx
        ? { ...generated, sampleId: spx.id, assay: spx.assay, priority: spx.priority, patientCode: spx.patientCode, tumorPercent: spx.tumorPercent, consentStatus: spx.consent, consentSetBy: spx.consentSetBy }
        : isSample && PLATE_WELL_OVERRIDES[wellId]
        ? { ...generated, ...PLATE_WELL_OVERRIDES[wellId] }
        : generated;
      wells.push(w);
    }
  }
  return wells;
}

const STREAMS: ReadonlyArray<DataStream> = [
  { id: 'st_manifest',  type: 'manifest',     label: 'Run Manifest',           producedByLane: 'lane_accession',     consumedByLane: 'lane_extraction',     format: 'JSON',  approxSize: '12 KB' },
  { id: 'st_qcmetrics', type: 'qc_metrics',   label: 'Extraction QC Metrics',  producedByLane: 'lane_extraction',    consumedByLane: 'lane_library',        format: 'CSV',   approxSize: '48 KB' },
  { id: 'st_bcl',       type: 'bcl',          label: 'BCL Basecalls',          producedByLane: 'lane_sequencer',     consumedByLane: 'lane_sequencer',      format: 'BCL',   approxSize: '1.6 TB' },
  { id: 'st_fastq',     type: 'fastq',        label: 'FASTQ Reads',            producedByLane: 'lane_sequencer',     consumedByLane: 'lane_secondary',      format: 'FASTQ', approxSize: '120 GB' },
  { id: 'st_bam',       type: 'bam',          label: 'Aligned BAM',            producedByLane: 'lane_secondary',     consumedByLane: 'lane_variant_review', format: 'BAM',   approxSize: '85 GB' },
  { id: 'st_cram',      type: 'cram',         label: 'CRAM (archive)',         producedByLane: 'lane_secondary',     consumedByLane: null,                  format: 'CRAM',  approxSize: '24 GB' },
  { id: 'st_vcf',       type: 'vcf',          label: 'Variants VCF',           producedByLane: 'lane_secondary',     consumedByLane: 'lane_variant_review', format: 'VCF',   approxSize: '180 MB' },
  { id: 'st_gvcf',      type: 'gvcf',         label: 'gVCF Joint Calls',       producedByLane: 'lane_secondary',     consumedByLane: 'lane_variant_review', format: 'gVCF',  approxSize: '420 MB' },
  { id: 'st_bed',       type: 'bed',          label: 'Capture Targets BED',    producedByLane: 'lane_library',       consumedByLane: 'lane_secondary',      format: 'BED',   approxSize: '2 MB' },
  { id: 'st_runmeta',   type: 'run_metadata', label: 'Run Metadata',           producedByLane: 'lane_sequencer',     consumedByLane: 'lane_secondary',      format: 'JSON',  approxSize: '32 KB' },
];

const CONNECTIONS: ReadonlyArray<ThirdPartyConnection> = [
  { id: 'cx_lims',     vendor: 'lims',     label: 'Lab LIMS',            purpose: 'Accession + sample tracking',     laneId: 'lane_accession',      authRequired: true,  online: true  },
  { id: 'cx_illumina', vendor: 'illumina', label: 'BaseSpace',           purpose: 'Run launch + monitoring',         laneId: 'lane_sequencer',      authRequired: true,  online: true  },
  { id: 'cx_dragen',   vendor: 'dragen',   label: 'DRAGEN Bio-IT',       purpose: 'Accelerated secondary analysis',  laneId: 'lane_secondary',      authRequired: true,  online: true  },
  { id: 'cx_gatk',     vendor: 'gatk',     label: 'GATK',                purpose: 'Variant calling alt pipeline',    laneId: 'lane_secondary',      authRequired: false, online: true  },
  { id: 'cx_igv',      vendor: 'igv',      label: 'IGV',                 purpose: 'Locus review for variant calls',  laneId: 'lane_variant_review', authRequired: false, online: true  },
  { id: 'cx_cosmic',   vendor: 'cosmic',   label: 'COSMIC',              purpose: 'Somatic mutation database',       laneId: 'lane_cancer_biology', authRequired: true,  online: false },
  { id: 'cx_clinvar',  vendor: 'clinvar',  label: 'ClinVar',             purpose: 'Clinical variant interpretation', laneId: 'lane_variant_review', authRequired: false, online: true  },
  { id: 'cx_oncokb',   vendor: 'oncokb',   label: 'OncoKB',              purpose: 'Actionability annotations',       laneId: 'lane_cancer_biology', authRequired: true,  online: true  },
  { id: 'cx_s3',       vendor: 'aws_s3',   label: 'AWS S3 (cold)',       purpose: 'CRAM archive + retention',        laneId: null,                  authRequired: true,  online: true  },
  { id: 'cx_notion',   vendor: 'aws_s3',   label: 'S3 Posture Docs',     purpose: 'Source-of-truth posture documents (versioned bucket)', laneId: null,        authRequired: true,  online: true  },
];

// ============================================================
// Specimen-level records — masonry cards. Each specimen carries a
// live preview of its underlying data plus the state controls that
// gate wet/dry-lab, review, and order transitions by role/profile.
// Consent posture propagates in from the Consent Registry (owned by
// Clinical Governance); SPX-2026-0487 mirrors plate well E3 — the
// patient rescinded consent, so analysis is held.
// ============================================================
const SPECIMENS: ReadonlyArray<Specimen> = [
  { id: 'SPX-2026-0481', patientCode: 'PT-2043', assay: 'panel_solid', priority: 'stat', stage: 'variant_review',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'phi', geographyCode: 'USE',
    indication: 'NSCLC, stage IV', specimenType: 'FFPE block · lung core', tumorPercent: 65, plateWell: 'B4',
    minWriteRole: 'reviewer', reviewState: 'in_review', sampleState: 'analyzed', orderState: 'in_progress',
    qcFlags: [], variantsCalled: 312,
    coverage: [{ label: 'Mean target cov', value: 94, target: 80, comparator: 'gte', unit: '×' }, { label: 'Q30', value: 93, target: 90, comparator: 'gte', unit: '%' }, { label: 'Uniformity', value: 88, target: 80, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-29', done: true }, { label: 'Extracted', at: '05-30', done: true }, { label: 'Sequenced', at: '06-02', done: true }, { label: 'Variant review', at: '06-05', done: false }],
    note: 'KRAS G12C candidate — expedited tumor board', accessionedAt: '2026-05-29' },
  { id: 'SPX-2026-0483', patientCode: 'PT-2119', assay: 'wes', priority: 'expedited', stage: 'secondary',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'de_identified', geographyCode: 'EUW',
    indication: 'Colorectal adenocarcinoma', specimenType: 'Whole blood · EDTA', tumorPercent: 48, plateWell: 'C7',
    minWriteRole: 'analyst', reviewState: 'unreviewed', sampleState: 'sequenced', orderState: 'in_progress',
    qcFlags: ['off_target_elevated'], variantsCalled: 208,
    coverage: [{ label: 'Mean target cov', value: 71, target: 80, comparator: 'gte', unit: '×' }, { label: 'Q30', value: 91, target: 90, comparator: 'gte', unit: '%' }, { label: 'Dup rate', value: 22, target: 30, comparator: 'lte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-30', done: true }, { label: 'Extracted', at: '05-31', done: true }, { label: 'Sequenced', at: '06-03', done: true }, { label: 'Secondary', at: '06-04', done: false }],
    note: 'Coverage under target — DRAGEN re-run queued', accessionedAt: '2026-05-30' },
  { id: 'SPX-2026-0485', patientCode: 'PT-2288', assay: 'panel_heme', priority: 'routine', stage: 'reported',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'phi', geographyCode: 'USE',
    indication: 'AML, relapsed', specimenType: 'Bone marrow aspirate', tumorPercent: 82, plateWell: 'A2',
    minWriteRole: 'arc_lead', reviewState: 'signed_off', sampleState: 'reported', orderState: 'fulfilled',
    qcFlags: [], variantsCalled: 141,
    coverage: [{ label: 'Mean target cov', value: 98, target: 80, comparator: 'gte', unit: '×' }, { label: 'Q30', value: 95, target: 90, comparator: 'gte', unit: '%' }, { label: 'Uniformity', value: 92, target: 80, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-24', done: true }, { label: 'Sequenced', at: '05-27', done: true }, { label: 'Signed out', at: '05-31', done: true }, { label: 'Delivered', at: '06-01', done: true }],
    note: 'FLT3-ITD detected · report delivered to EHR', accessionedAt: '2026-05-24' },
  { id: 'SPX-2026-0486', patientCode: 'PT-2310', assay: 'rna_seq', priority: 'routine', stage: 'library',
    consent: 'pending', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'de_identified', geographyCode: 'EUW',
    indication: 'Breast carcinoma, HER2-low', specimenType: 'FFPE block · breast', tumorPercent: 55, plateWell: 'B6',
    minWriteRole: 'lab_operator', reviewState: 'unreviewed', sampleState: 'in_process', orderState: 'on_hold',
    qcFlags: ['consent_pending'], variantsCalled: undefined,
    coverage: [{ label: 'RIN', value: 74, target: 70, comparator: 'gte', unit: '' }, { label: 'Library yield', value: 61, target: 50, comparator: 'gte', unit: 'nM' }],
    timeline: [{ label: 'Accessioned', at: '06-02', done: true }, { label: 'Extracted', at: '06-03', done: true }, { label: 'Library', at: '06-04', done: false }, { label: 'Sequence', at: '—', done: false }],
    note: 'Consent pending re-verification — order held', accessionedAt: '2026-06-02' },
  { id: 'SPX-2026-0487', patientCode: 'PT-2356', assay: 'wgs', priority: 'expedited', stage: 'on_hold',
    consent: 'rescinded', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'phi', geographyCode: 'USE',
    indication: 'Melanoma, metastatic', specimenType: 'FFPE block · skin (well E3)', tumorPercent: 70, plateWell: 'E3',
    minWriteRole: 'arc_lead', reviewState: 'unreviewed', sampleState: 'accessioned', orderState: 'on_hold',
    qcFlags: ['consent_rescinded', 'analysis_held'], variantsCalled: undefined,
    coverage: [{ label: 'Analysis', value: 0, target: 100, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-29', done: true }, { label: 'Consent rescinded', at: '06-07', done: true }, { label: 'Analysis held', at: '06-07', done: true }, { label: 'Purge review', at: '—', done: false }],
    note: 'CONSENT RESCINDED — analysis held; propagated from Consent Registry. No dry-lab processing permitted.', accessionedAt: '2026-05-29' },
  { id: 'SPX-2026-0489', patientCode: 'PT-2401', assay: 'methylation', priority: 'routine', stage: 'extraction',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'synthetic', geographyCode: 'APAC',
    indication: 'Glioma classification', specimenType: 'FFPE block · brain', tumorPercent: 60, plateWell: 'D9',
    minWriteRole: 'lab_operator', reviewState: 'unreviewed', sampleState: 'in_process', orderState: 'in_progress',
    qcFlags: [], variantsCalled: undefined,
    coverage: [{ label: 'DIN', value: 78, target: 70, comparator: 'gte', unit: '' }, { label: 'Yield', value: 66, target: 50, comparator: 'gte', unit: 'ng/µL' }],
    timeline: [{ label: 'Accessioned', at: '06-04', done: true }, { label: 'Extraction', at: '06-05', done: false }, { label: 'Array', at: '—', done: false }],
    note: 'EPIC array · classifier pending', accessionedAt: '2026-06-04' },
  { id: 'SPX-2026-0491', patientCode: 'PT-2467', assay: 'panel_solid', priority: 'expedited', stage: 'accessioned',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'de_identified', geographyCode: 'USE',
    indication: 'Pancreatic ductal adenocarcinoma', specimenType: 'Fine-needle aspirate', tumorPercent: 30, plateWell: 'F5',
    minWriteRole: 'lab_operator', reviewState: 'unreviewed', sampleState: 'accessioned', orderState: 'placed',
    qcFlags: ['low_tumor_fraction'], variantsCalled: undefined,
    coverage: [{ label: 'Tumor fraction', value: 30, target: 40, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '06-06', done: true }, { label: 'Extraction', at: '—', done: false }],
    note: 'Low tumor fraction — macrodissection advised', accessionedAt: '2026-06-06' },
  { id: 'SPX-2026-0493', patientCode: 'PT-2502', assay: 'wgs', priority: 'stat', stage: 'sequencing',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'phi', geographyCode: 'EUW',
    indication: 'Pediatric sarcoma', specimenType: 'Fresh frozen tissue', tumorPercent: 88, plateWell: 'G8',
    minWriteRole: 'analyst', reviewState: 'unreviewed', sampleState: 'sequenced', orderState: 'in_progress',
    qcFlags: [], variantsCalled: undefined,
    coverage: [{ label: 'Cluster PF', value: 84, target: 80, comparator: 'gte', unit: '%' }, { label: 'Q30', value: 92, target: 90, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '06-03', done: true }, { label: 'Library', at: '06-04', done: true }, { label: 'NovaSeq X', at: '06-06', done: false }],
    note: 'Trio WGS — germline comparator on plate G9/G10', accessionedAt: '2026-06-03' },
  { id: 'SPX-2026-0495', patientCode: 'PT-2560', assay: 'wes', priority: 'routine', stage: 'variant_review',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'de_identified', geographyCode: 'USE',
    indication: 'Ovarian carcinoma, HGSOC', specimenType: 'FFPE block · omentum', tumorPercent: 62, plateWell: 'C3',
    minWriteRole: 'reviewer', reviewState: 'changes_requested', sampleState: 'analyzed', orderState: 'in_progress',
    qcFlags: ['vus_conflict'], variantsCalled: 274,
    coverage: [{ label: 'Mean target cov', value: 90, target: 80, comparator: 'gte', unit: '×' }, { label: 'Q30', value: 93, target: 90, comparator: 'gte', unit: '%' }, { label: 'Uniformity', value: 85, target: 80, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-28', done: true }, { label: 'Sequenced', at: '05-31', done: true }, { label: 'Variant review', at: '06-05', done: false }],
    note: 'BRCA1 VUS — ClinVar/COSMIC discordance, reciprocal check open', accessionedAt: '2026-05-28' },
  { id: 'SPX-2026-0497', patientCode: 'PT-2618', assay: 'panel_heme', priority: 'expedited', stage: 'reported',
    consent: 'active', consentSetBy: 'Clinical Governance · Consent Registry', dataClass: 'phi', geographyCode: 'EUW',
    indication: 'CLL, IGHV-unmutated', specimenType: 'Peripheral blood', tumorPercent: 76, plateWell: 'A9',
    minWriteRole: 'arc_lead', reviewState: 'signed_off', sampleState: 'reported', orderState: 'fulfilled',
    qcFlags: [], variantsCalled: 97,
    coverage: [{ label: 'Mean target cov', value: 96, target: 80, comparator: 'gte', unit: '×' }, { label: 'Q30', value: 94, target: 90, comparator: 'gte', unit: '%' }],
    timeline: [{ label: 'Accessioned', at: '05-22', done: true }, { label: 'Sequenced', at: '05-25', done: true }, { label: 'Signed out', at: '05-29', done: true }, { label: 'Delivered', at: '05-30', done: true }],
    note: 'TP53 del(17p) — signed out, FHIR bundle delivered', accessionedAt: '2026-05-22' },
];

// ============================================================
// Quality Control — metrics and gates across the pipeline stages
// (wet lab → sequencing → secondary → sign-out). Gates are the
// GxP/CLIA review-release checkpoints surfaced by the LIMS pilot.
// ============================================================
const QC_METRICS: ReadonlyArray<QCMetric> = [
  { id: 'qcm_din',      label: 'DIN (extraction)',       value: 7.6,  unit: '',   threshold: 7.0,  comparator: 'gte', status: 'pass', stage: 'wet_lab',    trend: [7.1, 7.3, 7.0, 7.5, 7.4, 7.6] },
  { id: 'qcm_yield',    label: 'NA yield',               value: 42,   unit: 'ng/µL', threshold: 20, comparator: 'gte', status: 'pass', stage: 'wet_lab',    trend: [31, 28, 36, 40, 39, 42] },
  { id: 'qcm_libnm',    label: 'Library molarity',       value: 3.2,  unit: 'nM', threshold: 2.0,  comparator: 'gte', status: 'pass', stage: 'wet_lab',    trend: [2.4, 2.8, 2.6, 3.0, 3.1, 3.2] },
  { id: 'qcm_adapter',  label: 'Adapter dimer',          value: 4.1,  unit: '%',  threshold: 5.0,  comparator: 'lte', status: 'warn', stage: 'wet_lab',    trend: [2.0, 2.6, 3.2, 3.9, 4.4, 4.1] },
  { id: 'qcm_clusterpf', label: 'Cluster PF',            value: 84,   unit: '%',  threshold: 80,   comparator: 'gte', status: 'pass', stage: 'sequencing', trend: [82, 79, 85, 83, 86, 84] },
  { id: 'qcm_q30',      label: 'Q30',                    value: 93,   unit: '%',  threshold: 90,   comparator: 'gte', status: 'pass', stage: 'sequencing', trend: [90, 91, 92, 91, 93, 93] },
  { id: 'qcm_lanebal',  label: 'Lane balance CV',        value: 11,   unit: '%',  threshold: 10,   comparator: 'lte', status: 'fail', stage: 'sequencing', trend: [6, 7, 8, 9, 12, 11] },
  { id: 'qcm_phix',     label: 'PhiX error rate',        value: 0.32, unit: '%',  threshold: 0.5,  comparator: 'lte', status: 'pass', stage: 'sequencing', trend: [0.41, 0.38, 0.36, 0.30, 0.34, 0.32] },
  { id: 'qcm_meancov',  label: 'Mean target coverage',   value: 94,   unit: '×',  threshold: 80,   comparator: 'gte', status: 'pass', stage: 'secondary',  trend: [78, 82, 88, 90, 92, 94] },
  { id: 'qcm_uniform',  label: 'Coverage uniformity',    value: 88,   unit: '%',  threshold: 80,   comparator: 'gte', status: 'pass', stage: 'secondary',  trend: [80, 83, 85, 86, 87, 88] },
  { id: 'qcm_dup',      label: 'Duplication rate',       value: 22,   unit: '%',  threshold: 30,   comparator: 'lte', status: 'pass', stage: 'secondary',  trend: [26, 24, 25, 23, 22, 22] },
  { id: 'qcm_contam',   label: 'Contamination (VerifyBamID)', value: 1.4, unit: '%', threshold: 2.0, comparator: 'lte', status: 'warn', stage: 'secondary', trend: [0.6, 0.8, 1.1, 1.3, 1.5, 1.4] },
  { id: 'qcm_ts_tv',    label: 'Ts/Tv ratio',            value: 2.05, unit: '',   threshold: 2.0,  comparator: 'gte', status: 'pass', stage: 'secondary',  trend: [1.98, 2.0, 2.02, 2.04, 2.05, 2.05] },
  { id: 'qcm_conc',     label: 'Reviewer concordance',   value: 96,   unit: '%',  threshold: 95,   comparator: 'gte', status: 'pass', stage: 'sign_out',   trend: [94, 95, 95, 96, 96, 96] },
  { id: 'qcm_tat',      label: 'Turnaround time',        value: 9.2,  unit: 'd',  threshold: 10,   comparator: 'lte', status: 'pass', stage: 'sign_out',   trend: [11, 10.5, 10.1, 9.8, 9.4, 9.2] },
  { id: 'qcm_esig',     label: 'E-signature completeness', value: 99, unit: '%',  threshold: 100,  comparator: 'gte', status: 'warn', stage: 'sign_out',   trend: [100, 100, 98, 100, 99, 99] },
];
const QC_GATES: ReadonlyArray<QCGate> = [
  { id: 'qcg_extract', label: 'Extraction Release', stage: 'wet_lab', status: 'pass', description: 'DIN, yield, and molarity within spec before library prep proceeds.', owner: 'Wet Lab Supervisor', minWriteRole: 'lab_operator', metricIds: ['qcm_din', 'qcm_yield', 'qcm_libnm', 'qcm_adapter'], specimenScope: 'Plate NVSX-2026-118 · 88 specimens', blocking: true },
  { id: 'qcg_run', label: 'Sequencing Run Gate', stage: 'sequencing', status: 'fail', description: 'Run-level metrics must pass before demux is released downstream. Lane balance CV is out of spec — hold.', owner: 'Sequencing Lead', minWriteRole: 'analyst', metricIds: ['qcm_clusterpf', 'qcm_q30', 'qcm_lanebal', 'qcm_phix'], specimenScope: 'Run NVSX-2026-118 · flow cell A', blocking: true },
  { id: 'qcg_secondary', label: 'Secondary Analysis Gate', stage: 'secondary', status: 'warn', description: 'Coverage, contamination, and variant-QC before variant review. Contamination trending up on 3 specimens.', owner: 'Bioinformatics Lead', minWriteRole: 'analyst', metricIds: ['qcm_meancov', 'qcm_uniform', 'qcm_dup', 'qcm_contam', 'qcm_ts_tv'], specimenScope: 'Run NVSX-2026-118 · 85 passing', blocking: false },
  { id: 'qcg_signout', label: 'Result Release / Sign-out', stage: 'sign_out', status: 'warn', description: 'Two-person review concordance and e-signature completeness per 21 CFR Part 11 before report delivery.', owner: 'CLIA Lab Director', minWriteRole: 'arc_lead', metricIds: ['qcm_conc', 'qcm_tat', 'qcm_esig'], specimenScope: '12 reports in release queue', blocking: true },
];

// ============================================================
// Biomarkers — somatic / germline / signatures / expression / PgX
// with actionability tiers and evidence provenance.
// ============================================================
const BIOMARKERS: ReadonlyArray<Biomarker> = [
  { id: 'bm_krasg12c', name: 'KRAS G12C', gene: 'KRAS', category: 'somatic', value: 'Detected · VAF 34%', numericValue: 34, unit: '% VAF', actionability: 'tier_1', evidence: ['OncoKB Level 1', 'FDA label', 'COSMIC'], therapies: ['Sotorasib', 'Adagrasib'], reviewState: 'in_review', specimenId: 'SPX-2026-0481', indication: 'NSCLC, stage IV', minWriteRole: 'reviewer', note: 'Expedited to tumor board' },
  { id: 'bm_flt3itd', name: 'FLT3-ITD', gene: 'FLT3', category: 'somatic', value: 'Detected · AR 0.62', numericValue: 62, unit: '% AR', actionability: 'tier_1', evidence: ['OncoKB Level 1', 'NCCN'], therapies: ['Midostaurin', 'Gilteritinib'], reviewState: 'signed_off', specimenId: 'SPX-2026-0485', indication: 'AML, relapsed', minWriteRole: 'arc_lead' },
  { id: 'bm_brca1', name: 'BRCA1 c.5266dupC', gene: 'BRCA1', category: 'germline', value: 'VUS — conflicting', numericValue: undefined, actionability: 'tier_3', evidence: ['ClinVar (conflicting)', 'COSMIC'], therapies: ['PARP inhibitor (if reclassified)'], reviewState: 'changes_requested', specimenId: 'SPX-2026-0495', indication: 'Ovarian carcinoma, HGSOC', minWriteRole: 'reviewer', note: 'ClinVar/COSMIC discordance — reciprocal check open' },
  { id: 'bm_tp53', name: 'TP53 del(17p)', gene: 'TP53', category: 'somatic', value: 'Deleted · 38% cells', numericValue: 38, unit: '% cells', actionability: 'tier_2', evidence: ['OncoKB Level 2', 'COSMIC'], therapies: ['Venetoclax-based'], reviewState: 'signed_off', specimenId: 'SPX-2026-0497', indication: 'CLL, IGHV-unmutated', minWriteRole: 'arc_lead' },
  { id: 'bm_tmb', name: 'Tumor Mutational Burden', category: 'signature', value: '14.2 mut/Mb — high', numericValue: 14.2, unit: 'mut/Mb', actionability: 'tier_2', evidence: ['FoundationOne threshold', 'FDA pan-tumor'], therapies: ['Pembrolizumab (TMB-H)'], reviewState: 'in_review', specimenId: 'SPX-2026-0481', indication: 'NSCLC, stage IV', minWriteRole: 'reviewer' },
  { id: 'bm_msi', name: 'Microsatellite Instability', category: 'signature', value: 'MSI-High (28 loci)', numericValue: 28, unit: '% unstable', actionability: 'tier_1', evidence: ['OncoKB Level 1', 'FDA pan-tumor'], therapies: ['Immune checkpoint inhibitor'], reviewState: 'unreviewed', specimenId: 'SPX-2026-0483', indication: 'Colorectal adenocarcinoma', minWriteRole: 'reviewer' },
  { id: 'bm_hrd', name: 'HRD Score', category: 'signature', value: '52 — HR-deficient', numericValue: 52, unit: 'score', actionability: 'tier_2', evidence: ['Myriad threshold ≥42'], therapies: ['PARP inhibitor'], reviewState: 'changes_requested', specimenId: 'SPX-2026-0495', indication: 'Ovarian carcinoma, HGSOC', minWriteRole: 'reviewer' },
  { id: 'bm_her2', name: 'HER2 (ERBB2) expression', gene: 'ERBB2', category: 'expression', value: 'IHC 1+ / HER2-low', numericValue: 1, unit: 'IHC', actionability: 'tier_1', evidence: ['ASCO/CAP 2023', 'FDA label'], therapies: ['Trastuzumab deruxtecan'], reviewState: 'unreviewed', specimenId: 'SPX-2026-0486', indication: 'Breast carcinoma, HER2-low', minWriteRole: 'reviewer', note: 'Consent pending — held from tumor board' },
  { id: 'bm_dpyd', name: 'DPYD *2A', gene: 'DPYD', category: 'pgx', value: 'Heterozygous — reduced', numericValue: undefined, actionability: 'tier_1', evidence: ['CPIC Level A', 'PharmGKB'], therapies: ['Fluoropyrimidine dose reduction'], reviewState: 'signed_off', specimenId: 'SPX-2026-0483', indication: 'Colorectal adenocarcinoma', minWriteRole: 'arc_lead' },
  { id: 'bm_pdl1', name: 'PD-L1 (CPS)', category: 'expression', value: 'CPS 22 — positive', numericValue: 22, unit: 'CPS', actionability: 'tier_2', evidence: ['22C3 assay', 'FDA companion'], therapies: ['Pembrolizumab'], reviewState: 'in_review', specimenId: 'SPX-2026-0481', indication: 'NSCLC, stage IV', minWriteRole: 'reviewer' },
];

const PLATE: ReadonlyArray<Well> = buildPlate(SPECIMENS);
const WELL_RESULTS = buildWellResults(PLATE, SPECIMENS);

export const STORE: CartographyStore = {
  sources: SOURCES,
  instructions: INSTRUCTIONS,
  artifacts: ARTIFACTS,
  relationships: RELATIONSHIPS,
  comparisons: COMPARISONS,
  decisions: DECISIONS,
  generationPacket: GENERATION_PACKET,
  landmarks: LANDMARKS,
  graphNodes: GRAPH_NODES,
  graphEdges: GRAPH_EDGES,
  lanes: LANES,
  laneCards: LANE_CARDS,
  laneArrows: LANE_ARROWS,
  laneFlags: LANE_FLAGS,
  laneSurfaceLabels: LANE_SURFACE_LABELS,
  streams: STREAMS,
  connections: CONNECTIONS,
  plate: PLATE,
  wellResults: WELL_RESULTS,
  lifecycleRules: LIFECYCLE_RULES,
  specimens: SPECIMENS,
  qcMetrics: QC_METRICS,
  qcGates: QC_GATES,
  biomarkers: BIOMARKERS,
};
