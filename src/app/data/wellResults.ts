// ============================================================
// Well result stacks for plate NVSX-2026-118.
//
// Every result that resolves to a plate well: the primary run,
// coverage top-ups, contamination re-preps, computational
// reanalyses, and — for tumor-informed assays — the longitudinal
// plasma draws that link back to the solid-tumor anchor well.
// Each result lists the files it produced and the S3 lifecycle
// rule that governs them, so the UI can answer "is it readable
// right now?" without the scientist knowing AWS.
//
// Deterministic: generic wells derive from the same seeded hash
// as buildPlate(); specimen-linked wells carry curated stories.
// ============================================================

import type {
  Well, WellResult, ResultArtifact, ResultMetric, LifecycleRule, LifecycleRuleId,
  ArtifactKind, SampleAssay, Specimen, ResultKind,
} from '../types';
import type { RoleId } from '../types/access';

export const PLATE_ID = 'NVSX-2026-118';
/** "Today" for lifecycle ages — matches the app chrome date. */
export const RESULTS_AS_OF = '2026-09-28';
export const RESULTS_NOW_ISO = '2026-09-28T09:00:00Z';

const ROW_LETTERS = 'ABCDEFGH';
export function wellIdOf(row: number, col: number): string {
  return `${ROW_LETTERS[row]}${col + 1}`;
}

const KB = 1e3;
const MB = 1e6;
const GB = 1e9;
const TB = 1e12;

// ---- S3 lifecycle rules (per-stage prefixes) -----------------

export const LIFECYCLE_RULES: ReadonlyArray<LifecycleRule> = [
  {
    id: 'lc-qc-pinned', prefix: 'qc/',
    summary: 'QC metrics are kilobytes and read constantly, so they are pinned to S3 Standard and never archived.',
    transitions: [{ atDay: 0, storageClass: 'standard' }],
    retentionNote: 'Kept with the signed report.',
  },
  {
    id: 'lc-vcf-hot', prefix: 'vcf/',
    summary: 'VCFs, gVCFs and annotated calls stay instantly readable for re-interpretation. After a year they move to Standard-IA: still instant, with a small read fee.',
    transitions: [{ atDay: 0, storageClass: 'standard' }, { atDay: 365, storageClass: 'standard_ia' }],
    retentionNote: '10 years — variant re-interpretation duty.',
  },
  {
    id: 'lc-bam-v3', prefix: 'bam/',
    summary: 'BAMs start in Intelligent-Tiering, freeze into Glacier Flexible Retrieval at 90 days and Deep Archive at 365 days, and are deleted at 3 years because the CRAM is the copy of record.',
    transitions: [
      { atDay: 0, storageClass: 'intelligent_tiering' },
      { atDay: 90, storageClass: 'glacier_flexible' },
      { atDay: 365, storageClass: 'deep_archive' },
    ],
    expireAtDay: 1095,
    retentionNote: 'Deleted at 3 years — regenerate from CRAM if needed.',
  },
  {
    id: 'lc-cram-archive', prefix: 'cram/',
    summary: 'CRAM is the reads copy of record: Standard-IA at 30 days, then Glacier Instant Retrieval at 90 days. Cold, but still readable in milliseconds.',
    transitions: [
      { atDay: 0, storageClass: 'standard' },
      { atDay: 30, storageClass: 'standard_ia' },
      { atDay: 90, storageClass: 'glacier_ir' },
    ],
    retentionNote: '10 years — CLIA / CAP record retention.',
  },
  {
    id: 'lc-fastq-deep', prefix: 'fastq/',
    summary: 'FASTQ is only needed to re-align from scratch: Glacier Flexible at 30 days, Deep Archive at 120 days, deleted at 7 years.',
    transitions: [
      { atDay: 0, storageClass: 'standard' },
      { atDay: 30, storageClass: 'glacier_flexible' },
      { atDay: 120, storageClass: 'deep_archive' },
    ],
    expireAtDay: 2555,
    retentionNote: '7 years, then deleted.',
  },
  {
    id: 'lc-idat-hot', prefix: 'idat/',
    summary: 'Methylation array IDATs are small: S3 Standard for a year, then Standard-IA.',
    transitions: [{ atDay: 0, storageClass: 'standard' }, { atDay: 365, storageClass: 'standard_ia' }],
  },
];

const RULE_FOR: Record<ArtifactKind, LifecycleRuleId> = {
  qc: 'lc-qc-pinned', calls: 'lc-vcf-hot', vcf: 'lc-vcf-hot', gvcf: 'lc-vcf-hot',
  idat: 'lc-idat-hot', cram: 'lc-cram-archive', bam: 'lc-bam-v3', fastq: 'lc-fastq-deep',
};
const PREFIX: Record<ArtifactKind, string> = {
  qc: 'qc/', calls: 'vcf/', vcf: 'vcf/', gvcf: 'vcf/', idat: 'idat/', cram: 'cram/', bam: 'bam/', fastq: 'fastq/',
};
const EXT: Record<ArtifactKind, string> = {
  qc: 'qc.json', calls: 'calls.tsv.gz', vcf: 'vcf.gz', gvcf: 'g.vcf.gz', idat: 'idat.tar', cram: 'cram', bam: 'bam', fastq: 'fastq.gz',
};
export const ARTIFACT_ORDER: ReadonlyArray<ArtifactKind> = ['qc', 'calls', 'vcf', 'gvcf', 'idat', 'cram', 'bam', 'fastq'];

function files(
  sizes: Partial<Record<ArtifactKind, number>>,
  createdAt: string,
  plateId: string,
  plateWell: string,
  label: string,
  extra: Partial<Record<ArtifactKind, Partial<ResultArtifact>>> = {},
): ResultArtifact[] {
  return ARTIFACT_ORDER.filter((k) => sizes[k] != null).map((k) => ({
    kind: k,
    sizeBytes: Math.round(sizes[k]!),
    createdAt,
    ruleId: RULE_FOR[k],
    key: `${PREFIX[k]}${plateId}/${plateWell}/${label}.${EXT[k]}`,
    ...extra[k],
  }));
}

function reuse(from: ReadonlyArray<ResultArtifact>, kinds: ReadonlyArray<ArtifactKind>, fromId: string): ResultArtifact[] {
  return from.filter((a) => kinds.includes(a.kind)).map((a) => ({ ...a, reusedFrom: fromId }));
}

// ---- metrics ---------------------------------------------------

const m = (key: string, label: string, value: number, unit: string, target?: number, comparator?: 'gte' | 'lte'): ResultMetric =>
  ({ key, label, value, unit, target, comparator });
const COV = (v: number, t: number, label = 'Mean target coverage') => m('cov', label, v, '×', t, 'gte');
const Q30 = (v: number) => m('q30', 'Q30', v, '%', 90, 'gte');
const FREEMIX = (v: number) => m('freemix', 'Contamination (FREEMIX)', v, '%', 2, 'lte');
const DUP = (v: number, t: number) => m('dup', 'Duplication', v, '%', t, 'lte');
const TF = (v: number, label = 'Tumor fraction') => m('tf', label, v, '%', 40, 'gte');
const UDEPTH = (v: number) => m('udepth', 'Unique depth', v, '×', 10000, 'gte');
const INPUT = (v: number) => m('input', 'cfDNA input', v, 'ng', 20, 'gte');
const MVAF = (v: number) => m('mvaf', 'ctDNA mean VAF', v, '%');

// ---- pipelines & flow cells -------------------------------------

const DRAGEN_424 = 'DRAGEN 4.2.4 · GRCh38';
const DRAGEN_436 = 'DRAGEN 4.3.6 · GRCh38';
const MRD_PIPE = 'MRD-ctDNA 2.1 · fgbio duplex + DRAGEN 4.2.4';
const FC_A = '22HVKJLT3';
const FC_B = '22KMT7LT3';

// ---- deterministic hash (same family as buildPlate) -------------

function prand(seed: number): number {
  const x = Math.sin(seed * 9999.31) * 43758.5453;
  return x - Math.floor(x);
}
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

// ---- assay profiles ---------------------------------------------

interface AssayProfile {
  readonly label: string;
  readonly specimenType: string;
  readonly pipeline: string;
  readonly sizes: Partial<Record<ArtifactKind, number>>;
  readonly covTarget?: number;
  readonly covLabel?: string;
  readonly dupTarget?: number;
}

const PROFILE: Record<SampleAssay, AssayProfile> = {
  wgs:         { label: 'WGS 30× · PCR-free', specimenType: 'Whole blood · EDTA', pipeline: DRAGEN_424, covTarget: 30, covLabel: 'Mean coverage', dupTarget: 15,
                 sizes: { qc: 64 * KB, calls: 14 * MB, vcf: 182 * MB, gvcf: 4.2 * GB, cram: 31 * GB, bam: 96 * GB, fastq: 118 * GB } },
  wes:         { label: 'Exome 100×', specimenType: 'Whole blood · EDTA', pipeline: DRAGEN_424, covTarget: 80, dupTarget: 30,
                 sizes: { qc: 48 * KB, calls: 6 * MB, vcf: 38 * MB, gvcf: 1.1 * GB, cram: 4.1 * GB, bam: 12.4 * GB, fastq: 15 * GB } },
  panel_solid: { label: '523-gene solid tumor panel', specimenType: 'FFPE curl', pipeline: DRAGEN_424, covTarget: 500, dupTarget: 60,
                 sizes: { qc: 32 * KB, calls: 2.4 * MB, vcf: 7 * MB, cram: 2.2 * GB, bam: 6.6 * GB, fastq: 8.4 * GB } },
  panel_heme:  { label: '74-gene heme panel', specimenType: 'Bone marrow aspirate', pipeline: DRAGEN_424, covTarget: 500, dupTarget: 60,
                 sizes: { qc: 30 * KB, calls: 1.2 * MB, vcf: 3.1 * MB, cram: 1.5 * GB, bam: 4.6 * GB, fastq: 5.8 * GB } },
  rna_seq:     { label: 'RNA-seq · fusions + expression', specimenType: 'FFPE curl · RNA', pipeline: 'DRAGEN RNA 4.2.4 · Arriba 2.3',
                 sizes: { qc: 40 * KB, calls: 22 * MB, cram: 6.2 * GB, bam: 18 * GB, fastq: 21 * GB } },
  methylation: { label: 'EPIC methylation array', specimenType: 'FFPE curl · DNA', pipeline: 'minfi 1.48 · MNP classifier v12.8',
                 sizes: { qc: 20 * KB, calls: 48 * MB, idat: 16 * MB } },
};

function sizedFor(assay: SampleAssay, seed: number): Partial<Record<ArtifactKind, number>> {
  const j = 0.86 + prand(seed) * 0.28;
  const out: Partial<Record<ArtifactKind, number>> = {};
  for (const [k, v] of Object.entries(PROFILE[assay].sizes) as [ArtifactKind, number][]) out[k] = v * j;
  return out;
}

function assayMetrics(assay: SampleAssay, seed: number, freemix: number, covOverride?: number): ResultMetric[] {
  const p = PROFILE[assay];
  if (assay === 'rna_seq') {
    return [
      m('mapped', 'Uniquely mapped', round(84 + prand(seed) * 9), '%', 80, 'gte'),
      m('exonic', 'Exonic rate', round(62 + prand(seed + 1) * 18), '%', 60, 'gte'),
      DUP(round(28 + prand(seed + 2) * 18), 50),
    ];
  }
  if (assay === 'methylation') {
    return [
      m('detp', 'Probes passing det. p', round(96 + prand(seed) * 3.4), '%', 95, 'gte'),
      m('mnp', 'Classifier score', round(0.91 + prand(seed + 1) * 0.08, 2), '', 0.9, 'gte'),
    ];
  }
  const t = p.covTarget ?? 30;
  const cov = covOverride ?? Math.round(t * (1.08 + prand(seed) * 0.4));
  return [
    COV(cov, t, p.covLabel),
    Q30(round(91 + prand(seed + 1) * 4)),
    FREEMIX(freemix),
    DUP(round((p.dupTarget ?? 30) * (0.3 + prand(seed + 2) * 0.45)), p.dupTarget ?? 30),
  ];
}

function assayFinding(assay: SampleAssay, seed: number): string {
  const n = (lo: number, hi: number, s = 0) => Math.round(lo + prand(seed + s) * (hi - lo));
  switch (assay) {
    case 'wgs': return `${n(4100, 4900)}k variants · ${n(0, 2, 1)} reportable P/LP`;
    case 'wes': return `${n(180, 320)} coding variants · ${n(0, 2, 1)} reportable`;
    case 'panel_solid': return `${n(3, 14)} somatic SNV/indels · TMB ${round(2 + prand(seed + 2) * 12)} mut/Mb`;
    case 'panel_heme': return `${n(2, 7)} variants · ${prand(seed + 3) > 0.6 ? 'FLT3 wild-type' : 'no Tier I calls'}`;
    case 'rna_seq': return `${n(0, 3)} fusion candidates · 0 reportable`;
    case 'methylation': return `MNP class match · calibrated score ${round(0.91 + prand(seed + 1) * 0.08, 2)}`;
  }
}

// ---- builder context --------------------------------------------

type Draft = Omit<WellResult, 'id' | 'wellId' | 'seq'>;

interface Ctx {
  readonly well: Well;
  readonly wellId: string;
  readonly idx: number;
  readonly assay: SampleAssay;
  readonly common: Pick<WellResult, 'consent' | 'minWriteRole' | 'specimenId' | 'patientCode'>;
}

export function resultIdOf(wellId: string, seq: number): string {
  return `RES-${wellId}-${String(seq).padStart(2, '0')}`;
}

function freemixFor(well: Well): number {
  if (well.contaminationProb == null) throw new Error('Example generation requires canonical contamination data.');
  return round(0.2 + well.contaminationProb * 3.2, 2);
}

function primaryDraft(c: Ctx, over: Partial<Draft> = {}): Draft {
  const p = PROFILE[c.assay];
  const runDate = '2026-06-02';
  return {
    ...c.common,
    kind: 'primary',
    status: 'reportable',
    label: 'R1',
    title: `Primary · ${p.label}`,
    specimenType: p.specimenType,
    assayLabel: p.label,
    plateId: PLATE_ID,
    plateWell: c.wellId,
    flowCell: c.assay === 'methylation' ? undefined : FC_A,
    pipeline: p.pipeline,
    runDate,
    reason: `First result for this specimen on plate ${PLATE_ID}. It passed every release gate, so it is the source of truth for this well.`,
    metrics: assayMetrics(c.assay, c.idx * 7 + 3, freemixFor(c.well)),
    finding: assayFinding(c.assay, c.idx * 5 + 1),
    artifacts: files(sizedFor(c.assay, c.idx + 41), runDate, PLATE_ID, c.wellId, 'R1'),
    ...over,
  };
}

// ---- generic wells: primary, plus seeded reanalyses / top-ups ----

const REANALYSIS_NOTE: Record<SampleAssay, { pipeline: string; reason: string; ref: string }> = {
  wgs:         { pipeline: DRAGEN_436, ref: 'CC-2026-031', reason: 'A validated CNV caller rolled out under change control CC-2026-031. The same reads were re-called with DRAGEN 4.3.6 — no new sequencing and no new BAM.' },
  wes:         { pipeline: DRAGEN_436, ref: 'CC-2026-031', reason: 'A validated CNV caller rolled out under change control CC-2026-031. The same reads were re-called with DRAGEN 4.3.6 — no new sequencing and no new BAM.' },
  panel_solid: { pipeline: DRAGEN_436, ref: 'CC-2026-031', reason: 'A validated CNV caller rolled out under change control CC-2026-031. The same reads were re-called with DRAGEN 4.3.6 — no new sequencing and no new BAM.' },
  panel_heme:  { pipeline: DRAGEN_436, ref: 'CC-2026-031', reason: 'A validated CNV caller rolled out under change control CC-2026-031. The same reads were re-called with DRAGEN 4.3.6 — no new sequencing and no new BAM.' },
  rna_seq:     { pipeline: 'DRAGEN RNA 4.2.4 · Arriba 2.4', ref: 'CC-2026-034', reason: 'The fusion caller was upgraded to Arriba 2.4 under change control CC-2026-034. The same reads were re-called; the BAM was not regenerated.' },
  methylation: { pipeline: 'minfi 1.48 · MNP classifier v12.9', ref: 'CC-2026-036', reason: 'Brain-tumor classifier v12.9 was released under change control CC-2026-036. The same IDATs were re-scored — no new array run.' },
};

const REANALYSIS_FINDING: Record<string, string> = {
  A12: 'Calibrated score 0.93 → 0.96 · same methylation class',
  D2: 'New focal MET amplification (CN 9) — now reportable',
  E2: '1 new low-support fusion candidate — not reportable',
  F2: 'No change in reportable fusions',
  G12: 'Subclass confidence raised from low to high',
};

function genericStack(c: Ctx): Draft[] {
  if (c.common.consent !== 'active') {
    return [primaryDraft(c, {
      status: 'held',
      reason: `Consent is ${c.common.consent} in the Consent Registry, so this specimen is held: nothing is analyzed or released until Clinical Governance clears it.`,
      trigger: { source: 'Consent Registry', detail: `Consent ${c.common.consent} — analysis held` },
      finding: undefined,
      artifacts: files({ qc: 30 * KB }, '2026-06-02', PLATE_ID, c.wellId, 'R1'),
      metrics: [],
    })];
  }

  const roll = prand(c.idx + 11);
  const primary = primaryDraft(c);

  // Seeded computational reanalysis — same reads, new caller.
  if (roll < 0.1) {
    const note = REANALYSIS_NOTE[c.assay];
    const runDate = '2026-08-20';
    const fresh = c.assay === 'methylation'
      ? files({ qc: 20 * KB, calls: 49 * MB }, runDate, PLATE_ID, c.wellId, 'R2')
      : files({ qc: 48 * KB, calls: (PROFILE[c.assay].sizes.calls ?? 4 * MB) * 1.02, ...(PROFILE[c.assay].sizes.vcf ? { vcf: PROFILE[c.assay].sizes.vcf! * 1.03 } : {}) }, runDate, PLATE_ID, c.wellId, 'R2');
    const reused = reuse(primary.artifacts, ['idat', 'cram', 'bam', 'fastq'], resultIdOf(c.wellId, 0));
    return [
      { ...primary, status: 'superseded' },
      {
        ...primary,
        kind: 'reanalysis', status: 'reportable', label: 'R2',
        title: `Reanalysis · ${note.pipeline.split(' · ').slice(-1)[0]}`,
        pipeline: note.pipeline, runDate, flowCell: primary.flowCell,
        reason: note.reason,
        trigger: { source: 'Change control', refId: note.ref, detail: 'Validated pipeline release — re-call existing data' },
        supersedes: resultIdOf(c.wellId, 0),
        finding: REANALYSIS_FINDING[c.wellId] ?? primary.finding,
        artifacts: [...fresh, ...reused],
      },
    ];
  }

  // Seeded coverage top-up — sequencing assays only.
  if (roll < 0.18 && c.assay !== 'methylation') {
    const t = PROFILE[c.assay].covTarget ?? 80;
    const low = Math.round(t * (0.78 + prand(c.idx + 13) * 0.12));
    const merged = Math.round(t * (1.12 + prand(c.idx + 14) * 0.2));
    const runDate = '2026-06-16';
    const r1Metrics = assayMetrics(c.assay, c.idx * 7 + 3, freemixFor(c.well), c.assay === 'rna_seq' ? undefined : low);
    return [
      {
        ...primary, status: 'failed_qc',
        metrics: r1Metrics,
        reason: c.assay === 'rna_seq'
          ? 'Too few uniquely mapped reads to call fusions confidently — the library was under-sampled on flow cell A.'
          : `Mean coverage reached ${low}× against the ${t}× release target, so low-frequency variants could be missed.`,
        trigger: { source: 'Secondary Analysis Gate', refId: 'qcm_meancov', detail: `Coverage ${low}× < ${t}×` },
        finding: 'Not releasable at this depth',
      },
      {
        ...primary,
        kind: 'top_up', status: 'reportable', label: 'R2',
        title: 'Top-up sequencing · same library',
        flowCell: FC_B, runDate,
        reason: `The same library was re-sequenced on flow cell B — no new extraction. Merged with R1 reads it reaches ${merged}×, clearing the ${t}× target.`,
        trigger: { source: 'R1 coverage failure', refId: resultIdOf(c.wellId, 0), detail: `Merged coverage ${merged}× ≥ ${t}×` },
        supersedes: resultIdOf(c.wellId, 0),
        metrics: assayMetrics(c.assay, c.idx * 7 + 3, freemixFor(c.well), c.assay === 'rna_seq' ? undefined : merged),
        artifacts: files(sizedFor(c.assay, c.idx + 43), runDate, PLATE_ID, c.wellId, 'R2'),
      },
    ];
  }

  return [primary];
}

// ---- curated stories ---------------------------------------------

function ctDnaDraw(
  c: Ctx, series: string, label: string, title: string, plateId: string, plateWell: string, runDate: string,
  read: { vaf: number; seen: number; mtm: number; depth: number; input: number; emerging?: string },
  reason: string, over: Partial<Draft> = {},
): Draft {
  return {
    ...c.common,
    seriesLabel: series,
    kind: 'longitudinal', status: 'reportable', label, title,
    specimenType: 'Plasma cfDNA · Streck BCT',
    assayLabel: 'Personalized ctDNA panel · 16 tracked variants',
    plateId, plateWell, flowCell: '22JKL2LT3', pipeline: MRD_PIPE, runDate,
    reason,
    metrics: [UDEPTH(read.depth), INPUT(read.input), MVAF(read.vaf)],
    ctDna: { detected: read.seen > 0, meanVafPct: read.vaf, tracked: 16, detectedCount: read.seen, mtmPerMl: read.mtm, emerging: read.emerging },
    finding: read.seen > 0
      ? `ctDNA detected · ${read.seen}/16 variants · ${read.mtm} MTM/mL${read.emerging ? ` · ${read.emerging}` : ''}`
      : 'ctDNA not detected · 0/16 variants',
    artifacts: files({ qc: 36 * KB, calls: 0.2 * MB, vcf: 0.4 * MB, bam: 46 * GB, fastq: 52 * GB }, runDate, plateId, plateWell, label),
    ...over,
  };
}

function hotspotReprep(c: Ctx, before: number, after: number, newWell: string): Draft[] {
  const primary = primaryDraft(c, {
    status: 'failed_qc',
    metrics: assayMetrics(c.assay, c.idx * 7 + 3, before),
    reason: `VerifyBamID FREEMIX ${before}% is over the 2% limit. ${c.wellId} sat inside the cross-contamination hotspot (rows C–E, columns 4–6) traced to a multichannel tip-change fault during extraction.`,
    trigger: { source: 'Secondary Analysis Gate', refId: 'qcm_contam', detail: `FREEMIX ${before}% > 2.0%` },
    finding: 'Not releasable — mixed-sample signal',
  });
  const runDate = '2026-07-08';
  return [
    primary,
    {
      ...primary,
      seriesLabel: 'Hotspot re-prep',
      kind: 'reprep', status: 'reportable', label: 'R2',
      title: 'Re-extraction from residual stock',
      plateId: 'NVSX-2026-131', plateWell: newWell, flowCell: '22LBD5LT3', runDate,
      reason: `Re-extracted from residual stock onto a fresh plate with single-channel handling. Contamination resolved (${before}% → ${after}%), so this result replaces R1.`,
      trigger: { source: 'R1 contamination failure', refId: resultIdOf(c.wellId, 0), detail: 'Re-prep from residual material' },
      supersedes: resultIdOf(c.wellId, 0),
      metrics: assayMetrics(c.assay, c.idx * 7 + 3, after),
      finding: assayFinding(c.assay, c.idx * 5 + 1),
      artifacts: files(sizedFor(c.assay, c.idx + 47), runDate, 'NVSX-2026-131', newWell, 'R2'),
    },
  ];
}

const CURATED: Record<string, (c: Ctx) => Draft[]> = {
  // Tumor-informed ctDNA response monitoring — NSCLC, KRAS G12C on adagrasib.
  B4: (c) => {
    const series = 'Tumor-informed ctDNA · KRAS G12C on adagrasib';
    const t0 = files({ qc: 32 * KB, calls: 2.4 * MB, vcf: 7.2 * MB, cram: 2.3 * GB, bam: 6.8 * GB, fastq: 8.6 * GB }, '2026-06-02', PLATE_ID, 'B4', 'T0');
    return [
      {
        ...c.common, seriesLabel: series, kind: 'primary', status: 'reportable', label: 'T0',
        title: 'Solid tumor anchor · FFPE lung core', specimenType: 'FFPE block · lung core',
        assayLabel: '523-gene solid tumor panel', plateId: PLATE_ID, plateWell: 'B4', flowCell: FC_A, pipeline: DRAGEN_424, runDate: '2026-06-02',
        reason: 'The solid-tumor assay anchors the whole series. It found KRAS G12C (VAF 34%) plus 15 clonal passenger variants; those 16 became the personalized panel every later plasma draw is measured against.',
        metrics: [COV(612, 500), Q30(93), FREEMIX(0.4), TF(65)],
        finding: 'KRAS G12C VAF 34% · TMB 14.2 mut/Mb · 16 clonal variants selected for tracking',
        artifacts: t0,
      },
      {
        ...c.common, seriesLabel: series, kind: 'matched_normal', status: 'informational', label: 'N0',
        title: 'Matched normal · buffy coat', specimenType: 'Buffy coat · EDTA',
        assayLabel: 'Germline exome 100×', plateId: 'NVSX-2026-119', plateWell: 'B4', flowCell: FC_A, pipeline: DRAGEN_424, runDate: '2026-06-03',
        reason: 'White-blood-cell DNA filters out germline and clonal-hematopoiesis (CHIP) variants so they are never mistaken for tumor DNA in plasma. DNMT3A R882H was CHIP and was kept off the panel.',
        metrics: [COV(104, 80), Q30(94), FREEMIX(0.2)],
        finding: 'CHIP filter: DNMT3A R882H excluded · 0 germline P/LP',
        artifacts: files({ qc: 48 * KB, vcf: 38 * MB, cram: 4 * GB, bam: 11.9 * GB }, '2026-06-03', 'NVSX-2026-119', 'B4', 'N0'),
      },
      ctDnaDraw(c, series, 'T1', 'Plasma · baseline, pre-treatment', 'LBX-2026-031', 'C5', '2026-06-16',
        { vaf: 2.8, seen: 16, mtm: 412, depth: 18400, input: 28 },
        'Baseline plasma draw before adagrasib started — the tumor burden every later draw is compared against.'),
      ctDnaDraw(c, series, 'T2', 'Plasma · +4 wk on adagrasib', 'LBX-2026-044', 'A2', '2026-07-14',
        { vaf: 0.41, seen: 14, mtm: 61, depth: 21100, input: 31 },
        'Four weeks on adagrasib, ctDNA fell 85% — an early molecular response.'),
      ctDnaDraw(c, series, 'T3', 'Plasma · +8 wk on adagrasib', 'LBX-2026-058', 'F7', '2026-08-11',
        { vaf: 0.06, seen: 5, mtm: 9, depth: 19800, input: 26 },
        'Deep molecular response: only 5 of 16 tracked variants are still visible. This is the nadir.'),
      ctDnaDraw(c, series, 'T4', 'Plasma · +12 wk on adagrasib', 'LBX-2026-071', 'B3', '2026-09-08',
        { vaf: 0.22, seen: 11, mtm: 33, depth: 20500, input: 29, emerging: 'KRAS Y96C 0.08% (new)' },
        'ctDNA climbed 3.7× off the T3 nadir and a new KRAS Y96C appeared — the classic on-target resistance mutation to G12C inhibitors. Flagged for a replicate before tumor board.',
        { trigger: { source: 'Molecular progression rule', detail: '≥2× rise from nadir plus a novel variant → replicate before reporting' } }),
      ctDnaDraw(c, series, 'T4r', 'Replicate · 2nd Streck tube from T4', 'LBX-2026-073', 'B4', '2026-09-15',
        { vaf: 0.24, seen: 11, mtm: 35, depth: 22800, input: 30, emerging: 'KRAS Y96C 0.09% (reproduced)' },
        'Re-extracted the second blood tube from the same draw so the Y96C call could not be a PCR or library artifact. It reproduced with independent UMI families — confirmed and released.',
        { kind: 'reprep', trigger: { source: 'T4 progression flag', refId: resultIdOf('B4', 5), detail: 'Replicate required before release' } }),
      ctDnaDraw(c, series, 'T5', 'Plasma · +2 wk on pan-RAS(ON) arm', 'LBX-2026-080', 'D1', '2026-09-26',
        { vaf: 0, seen: 0, mtm: 0, depth: 0, input: 24 },
        'First draw after switching to the pan-RAS(ON) trial arm. Library prep is done; reads land when the NovaSeq X run completes.',
        { status: 'in_progress', ctDna: undefined, finding: undefined, metrics: [INPUT(24)], artifacts: files({ qc: 12 * KB }, '2026-09-26', 'LBX-2026-080', 'D1', 'T5') }),
    ];
  },

  // Tumor-informed MRD — colorectal, post-resection surveillance.
  E10: (c) => {
    const series = 'Tumor-informed MRD · colorectal, post-resection';
    return [
      primaryDraft(c, {
        seriesLabel: series, label: 'T0', title: 'Solid tumor anchor · FFPE colectomy', specimenType: 'FFPE block · colon',
        reason: 'The resected tumor defines this patient\u2019s personalized MRD panel: APC, TP53 R175H and KRAS G12D plus 13 clonal passengers — 16 variants tracked in every plasma draw.',
        metrics: [COV(588, 500), Q30(92), FREEMIX(0.5), TF(55)],
        finding: 'APC · TP53 R175H · KRAS G12D — 16 clonal variants selected for tracking',
        artifacts: files({ qc: 32 * KB, calls: 2.2 * MB, vcf: 6.8 * MB, cram: 2.1 * GB, bam: 6.4 * GB, fastq: 8.1 * GB }, '2026-06-02', PLATE_ID, 'E10', 'T0'),
      }),
      {
        ...c.common, seriesLabel: series, kind: 'matched_normal', status: 'informational', label: 'N0',
        title: 'Matched normal · PBMC', specimenType: 'PBMC · EDTA', assayLabel: 'Germline exome 100×',
        plateId: 'NVSX-2026-119', plateWell: 'E10', flowCell: FC_A, pipeline: DRAGEN_424, runDate: '2026-06-03',
        reason: 'The PBMC normal strips germline and CHIP noise out of the panel design, so plasma signal can only come from the tumor.',
        metrics: [COV(98, 80), Q30(93), FREEMIX(0.3)],
        finding: '0 CHIP variants overlapping the panel',
        artifacts: files({ qc: 48 * KB, vcf: 37 * MB, cram: 3.9 * GB, bam: 11.6 * GB }, '2026-06-03', 'NVSX-2026-119', 'E10', 'N0'),
      },
      ctDnaDraw(c, series, 'T1', 'Plasma · post-op week 4', 'LBX-2026-034', 'H2', '2026-06-17',
        { vaf: 0.031, seen: 4, mtm: 2.1, depth: 24100, input: 33 },
        'Four weeks after surgery ctDNA is still present (4 of 16 variants) — residual disease. This result supported escalating to adjuvant FOLFOX.'),
      ctDnaDraw(c, series, 'T2', 'Plasma · mid-adjuvant', 'LBX-2026-049', 'C9', '2026-08-04',
        { vaf: 0, seen: 0, mtm: 0, depth: 25600, input: 35 },
        'Cleared on adjuvant chemotherapy — no tracked variant detected (molecular remission).'),
      ctDnaDraw(c, series, 'T3', 'Plasma · post-adjuvant surveillance', 'LBX-2026-066', 'A11', '2026-09-08',
        { vaf: 0.011, seen: 2, mtm: 0.8, depth: 26900, input: 34 },
        'ctDNA re-emerged at 2 of 16 variants — that meets the two-variant molecular-recurrence threshold, usually months ahead of imaging. A confirmation draw was ordered.',
        { trigger: { source: 'MRD call rule', detail: '≥2 tracked variants, each with ≥2 unique molecules' } }),
      ctDnaDraw(c, series, 'T3c', 'Confirmation draw', 'LBX-2026-079', 'F10', '2026-09-22',
        { vaf: 0, seen: 0, mtm: 0, depth: 0, input: 31 },
        'Repeat draw to confirm the T3 molecular recurrence before oncology acts on it. Library prep complete; sequencing scheduled.',
        { status: 'in_progress', ctDna: undefined, finding: undefined, metrics: [INPUT(31)], artifacts: files({ qc: 12 * KB }, '2026-09-22', 'LBX-2026-079', 'F10', 'T3c'),
          trigger: { source: 'T3 MRD call', refId: resultIdOf('E10', 4), detail: 'Confirm before clinical action' } }),
    ];
  },

  // CLL clonal evolution — includes 2024/2025 data now in deep archive.
  A9: (c) => {
    const series = 'Clonal evolution · CLL 2024 → 2026';
    const heme = '74-gene heme panel + IGHV';
    return [
      {
        ...c.common, seriesLabel: series, kind: 'primary', status: 'reportable', label: 'T0',
        title: 'Diagnostic · peripheral blood', specimenType: 'Peripheral blood', assayLabel: heme,
        plateId: 'NVSX-2024-077', plateWell: 'D2', flowCell: '21AFT9LT3', pipeline: 'DRAGEN 3.10.4 · GRCh38', runDate: '2024-08-14',
        reason: 'Diagnostic baseline: IGHV-unmutated CLL, TP53 wild-type. Every later result on this patient is compared against it.',
        metrics: [COV(842, 500), Q30(92), FREEMIX(0.3)],
        finding: 'IGHV unmutated · TP53 wild-type · SF3B1 K700E 22%',
        artifacts: files({ qc: 30 * KB, calls: 1.1 * MB, vcf: 3.1 * MB, cram: 1.5 * GB, bam: 4.6 * GB, fastq: 5.8 * GB }, '2024-08-14', 'NVSX-2024-077', 'D2', 'T0'),
      },
      {
        ...c.common, seriesLabel: series, kind: 'longitudinal', status: 'reportable', label: 'T1',
        title: 'Pre-treatment re-baseline', specimenType: 'Peripheral blood', assayLabel: heme,
        plateId: 'NVSX-2025-061', plateWell: 'B8', flowCell: '22CRT1LT3', pipeline: 'DRAGEN 4.0.3 · GRCh38', runDate: '2025-05-06',
        reason: 'The re-baseline before therapy found a 4% TP53 subclone — below the 10% reporting threshold then, but it is the clone that later took over.',
        metrics: [COV(877, 500), Q30(93), FREEMIX(0.2)],
        finding: 'TP53 R248Q subclone 4% (below reporting threshold)',
        artifacts: files({ qc: 30 * KB, calls: 1.2 * MB, vcf: 3.2 * MB, cram: 1.6 * GB, bam: 4.8 * GB, fastq: 6.1 * GB }, '2025-05-06', 'NVSX-2025-061', 'B8', 'T1'),
      },
      primaryDraft(c, {
        seriesLabel: series, kind: 'longitudinal', label: 'T2', title: 'Progression · peripheral blood', specimenType: 'Peripheral blood',
        assayLabel: heme, runDate: '2026-05-25',
        reason: 'At progression TP53 del(17p) is in 38% of cells — the 2025 subclone became dominant. Signed out and delivered as a FHIR bundle.',
        metrics: [COV(905, 500), Q30(94), FREEMIX(0.3)],
        finding: 'TP53 del(17p) 38% of cells · TP53 R248Q 31%',
        artifacts: files({ qc: 30 * KB, calls: 1.2 * MB, vcf: 3.3 * MB, cram: 1.6 * GB, bam: 4.9 * GB, fastq: 6.2 * GB }, '2026-05-25', PLATE_ID, 'A9', 'T2'),
      }),
    ];
  },

  // AML — diagnosis, MRD-negative remission, relapse.
  A2: (c) => {
    const series = 'AML · diagnosis → relapse';
    return [
      {
        ...c.common, seriesLabel: series, kind: 'primary', status: 'reportable', label: 'T0',
        title: 'Diagnosis · bone marrow', specimenType: 'Bone marrow aspirate', assayLabel: '74-gene heme panel',
        plateId: 'NVSX-2025-188', plateWell: 'C4', flowCell: '22FQM8LT3', pipeline: DRAGEN_424, runDate: '2025-09-12',
        reason: 'Diagnostic marrow: NPM1-mutated AML with FLT3-ITD — the two markers used to follow this patient\u2019s disease.',
        metrics: [COV(812, 500), Q30(93), FREEMIX(0.3)],
        finding: 'NPM1 type A · FLT3-ITD allelic ratio 0.48',
        artifacts: files({ qc: 30 * KB, calls: 1.2 * MB, vcf: 3 * MB, cram: 1.5 * GB, bam: 4.5 * GB, fastq: 5.7 * GB }, '2025-09-12', 'NVSX-2025-188', 'C4', 'T0'),
      },
      {
        ...c.common, seriesLabel: series, kind: 'longitudinal', status: 'reportable', label: 'T1',
        title: 'Post-induction MRD · bone marrow', specimenType: 'Bone marrow aspirate', assayLabel: '74-gene heme panel · MRD mode',
        plateId: 'NVSX-2025-231', plateWell: 'F6', flowCell: '22GWK2LT3', pipeline: DRAGEN_424, runDate: '2025-11-20',
        reason: 'After induction both markers fell below detection — an MRD-negative remission.',
        metrics: [COV(2410, 2000, 'Mean target coverage (MRD)'), Q30(94), FREEMIX(0.2)],
        finding: 'FLT3-ITD not detected · NPM1 MRD negative',
        artifacts: files({ qc: 30 * KB, calls: 1 * MB, vcf: 2.6 * MB, cram: 3.9 * GB, bam: 11.8 * GB, fastq: 14.6 * GB }, '2025-11-20', 'NVSX-2025-231', 'F6', 'T1'),
      },
      primaryDraft(c, {
        seriesLabel: series, kind: 'longitudinal', label: 'T2', title: 'Relapse · bone marrow', specimenType: 'Bone marrow aspirate',
        assayLabel: '74-gene heme panel', runDate: '2026-05-27',
        reason: 'Relapse: FLT3-ITD returned at a higher allelic ratio than at diagnosis, confirming gilteritinib eligibility. Report delivered to the EHR.',
        metrics: [COV(866, 500), Q30(95), FREEMIX(0.3)],
        finding: 'FLT3-ITD allelic ratio 0.62 — above diagnosis',
        artifacts: files({ qc: 30 * KB, calls: 1.3 * MB, vcf: 3.2 * MB, cram: 1.6 * GB, bam: 4.8 * GB, fastq: 6 * GB }, '2026-05-27', PLATE_ID, 'A2', 'T2'),
      }),
    ];
  },

  // Coverage failure → top-up of the same library, re-run queued.
  C7: (c) => {
    const r1 = primaryDraft(c, {
      seriesLabel: 'Coverage rerun', status: 'failed_qc', runDate: '2026-06-03',
      reason: 'Mean target coverage reached only 71× against the 80× release threshold — too thin to call heterozygous variants confidently across roughly 9% of exons. Off-target reads were also elevated.',
      trigger: { source: 'Secondary Analysis Gate', refId: 'qcm_meancov', detail: 'Mean target coverage 71× < 80×' },
      metrics: [COV(71, 80), Q30(91), FREEMIX(1.7), DUP(22, 30), m('offtarget', 'Off-target reads', 31, '%', 25, 'lte')],
      finding: '208 variants called — not releasable at this depth',
      artifacts: files({ qc: 48 * KB, vcf: 36 * MB, cram: 3.3 * GB, bam: 9.8 * GB, fastq: 11.7 * GB }, '2026-06-03', PLATE_ID, 'C7', 'R1'),
    });
    return [
      r1,
      {
        ...r1, kind: 'top_up', status: 'in_progress', label: 'R2', title: 'Top-up sequencing · same library',
        flowCell: FC_B, runDate: '2026-09-12',
        reason: 'The same library was re-sequenced on flow cell B to add depth — no new extraction needed. Reads landed on 09-12; the DRAGEN re-run on the merged reads is queued (the "re-run queued" note in the Specimen Registry).',
        trigger: { source: 'R1 coverage failure', refId: resultIdOf('C7', 0), detail: 'Top-up projected to reach 98× merged' },
        supersedes: resultIdOf('C7', 0),
        metrics: [COV(98, 80, 'Projected merged coverage'), Q30(93)],
        finding: undefined,
        artifacts: files({ qc: 46 * KB, fastq: 6.2 * GB }, '2026-09-12', PLATE_ID, 'C7', 'R2'),
      },
    ];
  },

  // Stat deep tumor WGS — three flow cells merged into a multi-terabyte BAM.
  G8: (c) => {
    const series = 'Deep tumor WGS · trio';
    const base: Draft = {
      ...c.common, seriesLabel: series, kind: 'primary', status: 'superseded', label: 'R1',
      title: 'Tumor WGS · flow cell A', specimenType: 'Fresh frozen tissue', assayLabel: 'Tumor WGS · 180× target',
      plateId: PLATE_ID, plateWell: 'G8', flowCell: '22HVM3LT3', pipeline: DRAGEN_424, runDate: '2026-06-06',
      reason: 'Stat tumor WGS needs at least 180× to resolve low-VAF subclones for the trio analysis. Flow cell A delivered 112×.',
      trigger: { source: 'Assay design', detail: 'Tumor depth 112× < 180× target' },
      metrics: [COV(112, 180, 'Mean coverage'), Q30(92), FREEMIX(0.3), DUP(9, 15)],
      finding: 'Interim calls only — depth below design',
      artifacts: files({ qc: 70 * KB, vcf: 210 * MB, bam: 702 * GB, fastq: 690 * GB }, '2026-06-06', PLATE_ID, 'G8', 'R1'),
    };
    const r3Files = files({ qc: 72 * KB, calls: 18 * MB, vcf: 236 * MB, gvcf: 5.1 * GB, cram: 688 * GB, bam: 2.31 * TB, fastq: 410 * GB }, '2026-06-21', PLATE_ID, 'G8', 'R3');
    return [
      base,
      {
        ...base, kind: 'top_up', label: 'R2', title: 'Top-up · flow cell B', flowCell: '22JNB8LT3', runDate: '2026-06-14',
        reason: 'A second flow cell added 56×. Merged depth reached 168× — still short of the 180× design.',
        trigger: { source: 'R1 depth shortfall', refId: resultIdOf('G8', 0), detail: 'Merged 168× < 180×' },
        supersedes: resultIdOf('G8', 0),
        metrics: [COV(168, 180, 'Merged coverage'), Q30(93), FREEMIX(0.3), DUP(10, 15)],
        artifacts: files({ qc: 71 * KB, bam: 1.38 * TB, fastq: 352 * GB }, '2026-06-14', PLATE_ID, 'G8', 'R2'),
      },
      {
        ...base, kind: 'top_up', label: 'R3', title: 'Top-up · flow cell C', flowCell: '22JX2CLT3', runDate: '2026-06-21',
        reason: 'A third flow cell brought merged tumor depth to 204× and the run was released. This merged BAM is the read set every later call on this patient is made from.',
        trigger: { source: 'R2 depth shortfall', refId: resultIdOf('G8', 1), detail: 'Merged 204× ≥ 180× — released' },
        supersedes: resultIdOf('G8', 1),
        metrics: [COV(204, 180, 'Merged coverage'), Q30(93), FREEMIX(0.3), DUP(10, 15)],
        finding: 'EWSR1–FLI1 fusion · 2 subclonal drivers under 8% VAF',
        artifacts: r3Files,
      },
      {
        ...base, kind: 'reanalysis', status: 'reportable', label: 'R4', title: 'SV re-call · DRAGEN 4.3.6', pipeline: DRAGEN_436, runDate: '2026-09-19',
        reason: 'A validated structural-variant caller was rolled out under change control CC-2026-031. The same merged reads were re-called — no new sequencing and no new BAM. The fusion breakpoint was refined to EWSR1 exon 7 / FLI1 exon 6.',
        trigger: { source: 'Change control', refId: 'CC-2026-031', detail: 'Validated SV caller release' },
        supersedes: resultIdOf('G8', 2),
        metrics: [COV(204, 180, 'Merged coverage'), Q30(93), FREEMIX(0.3), DUP(10, 15)],
        finding: 'EWSR1 ex7 – FLI1 ex6 fusion (refined) · 2 subclonal drivers',
        artifacts: [
          ...files({ qc: 52 * KB, calls: 4 * MB, vcf: 12 * MB }, '2026-09-19', PLATE_ID, 'G8', 'R4'),
          ...reuse(r3Files, ['cram', 'bam'], resultIdOf('G8', 2)),
        ],
      },
    ];
  },

  D6: (c) => hotspotReprep(c, 3.8, 0.3, 'A4'),
  D5: (c) => hotspotReprep(c, 2.4, 0.4, 'A5'),
  E5: (c) => hotspotReprep(c, 2.2, 0.5, 'A6'),

  // Germline VUS — annotation refresh, then orthogonal confirmation.
  C3: (c) => {
    const r1 = primaryDraft(c, {
      seriesLabel: 'VUS reanalysis', status: 'superseded', runDate: '2026-05-31',
      reason: 'The primary exome called BRCA1 c.5266dupC; ClinVar and COSMIC disagree on its classification, so a reciprocal check was opened.',
      metrics: [COV(90, 80), Q30(93), FREEMIX(0.6), DUP(19, 30)],
      finding: 'BRCA1 c.5266dupC · VUS (conflicting) · HRD score 52',
      artifacts: files({ qc: 48 * KB, calls: 6 * MB, vcf: 38 * MB, gvcf: 1.1 * GB, cram: 4.1 * GB, bam: 12.2 * GB, fastq: 14.8 * GB }, '2026-05-31', PLATE_ID, 'C3', 'R1'),
    });
    return [
      r1,
      {
        ...r1, kind: 'reanalysis', status: 'reportable', label: 'R2', title: 'Annotation refresh · ClinVar 2026-08',
        pipeline: 'VEP 112 · ClinVar 2026-08 · DRAGEN 4.2.4 calls', runDate: '2026-08-27',
        reason: 'Re-annotation only — no new reads. The August ClinVar release added two submissions, but the classification is still conflicting, so the reciprocal check stays open.',
        trigger: { source: 'Variant Review', detail: 'Reciprocal check open — VUS conflict' },
        supersedes: resultIdOf('C3', 0),
        finding: 'BRCA1 c.5266dupC · still conflicting (2 new submissions)',
        artifacts: [
          ...files({ qc: 40 * KB, calls: 6.1 * MB, vcf: 38 * MB }, '2026-08-27', PLATE_ID, 'C3', 'R2'),
          ...reuse(r1.artifacts, ['cram', 'bam', 'fastq'], resultIdOf('C3', 0)),
        ],
      },
      {
        ...r1, kind: 'orthogonal', status: 'in_progress', label: 'R3', title: 'Orthogonal confirm · Sanger',
        assayLabel: 'Sanger · BRCA1 exon 20', pipeline: 'Sanger · Mutation Surveyor 5.2', flowCell: undefined, runDate: '2026-09-24',
        reason: 'Sanger sequencing of BRCA1 exon 20 confirms the call and its zygosity by an independent method before sign-out.',
        trigger: { source: 'Sign-out policy', detail: 'Orthogonal confirmation required for germline P/LP or conflicting VUS' },
        supersedes: undefined, metrics: [], finding: undefined, artifacts: [],
      },
    ];
  },

  // Consent rescinded after sequencing — held, legal hold, reflex cancelled.
  E3: (c) => {
    const r1 = primaryDraft(c, {
      seriesLabel: 'Consent rescinded', status: 'held',
      reason: 'Sequencing finished on 06-02 — five days before the patient rescinded consent (06-07). The result is withheld: no analysis, no release, and the files sit under an S3 Object Lock legal hold pending purge review.',
      trigger: { source: 'Consent Registry', detail: 'Rescinded 2026-06-07 · Clinical Governance' },
      metrics: [COV(34, 30, 'Mean coverage'), Q30(92)],
      finding: undefined,
      artifacts: files({ qc: 64 * KB, cram: 30 * GB, bam: 98 * GB, fastq: 121 * GB }, '2026-06-02', PLATE_ID, 'E3', 'R1',
        { qc: { legalHold: true }, cram: { legalHold: true }, bam: { legalHold: true }, fastq: { legalHold: true } }),
    });
    return [
      r1,
      {
        ...r1, kind: 'reflex', status: 'cancelled', label: 'R2', title: 'Tumor–normal reflex · cancelled', runDate: '2026-06-07',
        reason: 'The planned matched-normal reflex was cancelled automatically the moment consent was rescinded.',
        trigger: { source: 'Consent Registry', detail: 'Order auto-cancelled on rescission' },
        metrics: [], artifacts: [],
      },
    ];
  },

  B6: (c) => [primaryDraft(c, {
    status: 'held', runDate: '2026-06-04', flowCell: undefined, title: 'RNA-seq · FFPE breast · library paused',
    reason: 'Library prep is paused because consent is pending re-verification. Nothing is sequenced or analyzed until the Consent Registry clears it.',
    trigger: { source: 'Consent Registry', detail: 'Pending re-verification since 2026-06-02' },
    metrics: [m('rin', 'RIN', 7.4, '', 7, 'gte')], finding: undefined, artifacts: [],
  })],

  D9: (c) => [primaryDraft(c, {
    status: 'in_progress', runDate: '2026-06-05', title: 'EPIC array · FFPE brain',
    reason: 'Extraction is complete and the EPIC array scan is scheduled. The brain-tumor classifier runs as soon as the IDATs land.',
    metrics: [m('din', 'DIN', 7.8, '', 7, 'gte')], finding: undefined, artifacts: [],
  })],

  F5: (c) => {
    const r1 = primaryDraft(c, {
      seriesLabel: 'Low tumor fraction', status: 'failed_qc', runDate: '2026-06-06', flowCell: undefined,
      title: 'Pre-analytic review · fine-needle aspirate',
      reason: 'Pathology estimated 30% tumor cells — under the 40% minimum for confident somatic calling, so the specimen was stopped before sequencing.',
      trigger: { source: 'Pre-analytic review', detail: 'Tumor fraction 30% < 40%' },
      metrics: [TF(30)], finding: undefined, artifacts: [],
    });
    return [
      r1,
      {
        ...r1, kind: 'reprep', status: 'in_progress', label: 'R2', title: 'Macrodissection re-prep', runDate: '2026-06-12',
        reason: 'Pathologist-guided macrodissection enriches tumor cells before extraction; expected tumor fraction is about 55%.',
        trigger: { source: 'R1 pre-analytic failure', refId: resultIdOf('F5', 0), detail: 'Macrodissection advised' },
        supersedes: resultIdOf('F5', 0),
        metrics: [TF(55, 'Tumor fraction (est.)')],
      },
    ];
  },

  G9: (c) => [trioParent(c, 'mother')],
  G10: (c) => [trioParent(c, 'father')],

  // Generic wells with a restore already in flight / completed.
  H2: (c) => [primaryDraft(c, {
    artifacts: files(sizedFor('wgs', c.idx + 41), '2026-06-02', PLATE_ID, 'H2', 'R1', {
      bam: { restore: { state: 'in_progress', tier: 'standard', requestedAt: '2026-09-28T06:10:00Z', readyAt: '2026-09-28T10:40:00Z' } },
    }),
  })],
  D12: (c) => [primaryDraft(c, {
    artifacts: files(sizedFor('wgs', c.idx + 41), '2026-06-02', PLATE_ID, 'D12', 'R1', {
      bam: { restore: { state: 'restored', tier: 'bulk', requestedAt: '2026-09-25T14:02:00Z', readyAt: '2026-09-26T01:30:00Z', expiresAt: '2026-10-02' } },
    }),
  })],
};

function trioParent(c: Ctx, who: 'mother' | 'father'): Draft {
  return primaryDraft(c, {
    seriesLabel: 'Deep tumor WGS · trio', kind: 'matched_normal', status: 'informational',
    label: 'P1', title: `Trio · parental germline (${who})`, runDate: '2026-06-06',
    reason: 'Parental germline genome for the G8 trio — it separates de novo variants in the child\u2019s tumor from inherited ones.',
    finding: '0 de novo-relevant P/LP variants',
  });
}

function controlStack(c: Ctx): Draft[] {
  const positive = c.well.role === 'positive_control';
  return [{
    consent: 'active', minWriteRole: 'analyst',
    kind: 'control', status: 'informational', label: 'C',
    title: positive ? 'Positive control · NA12878 (GIAB HG001)' : 'Negative control · no-template',
    specimenType: positive ? 'Reference DNA · Coriell' : 'Nuclease-free water',
    assayLabel: positive ? 'Exome 100× · run control' : 'No-template control',
    plateId: PLATE_ID, plateWell: c.wellId, flowCell: FC_A, pipeline: DRAGEN_424, runDate: '2026-06-02',
    reason: positive
      ? 'Run control: the GIAB reference sample proves the run can call known variants before any patient result is trusted.'
      : 'No-template control: proves reagents and the plate carried no stray DNA into the run.',
    metrics: positive
      ? [m('giab', 'GIAB concordance', 99.7, '%', 99.5, 'gte'), Q30(94)]
      : [m('ntc', 'Reads vs. median sample', 0.02, '%', 0.1, 'lte')],
    finding: positive ? 'SNV F1 0.997 · indel F1 0.991' : 'Clean — 0.02% of median reads',
    artifacts: positive
      ? files({ qc: 48 * KB, vcf: 40 * MB, cram: 3.8 * GB, bam: 11 * GB }, '2026-06-02', PLATE_ID, c.wellId, 'C')
      : files({ qc: 12 * KB }, '2026-06-02', PLATE_ID, c.wellId, 'C'),
  }];
}

/** Optional well-level overrides for wells whose plate record is not in the Specimen Registry. */
export const PLATE_WELL_OVERRIDES: Readonly<Record<string, Partial<Pick<Well, 'assay' | 'note'>>>> = {
  G9: { assay: 'wgs', note: 'Trio parental germline (mother) — comparator for G8' },
  G10: { assay: 'wgs', note: 'Trio parental germline (father) — comparator for G8' },
};

export function buildWellResults(plate: ReadonlyArray<Well>, specimens: ReadonlyArray<Specimen>): ReadonlyArray<WellResult> {
  const out: WellResult[] = [];
  for (const well of plate) {
    if (well.role === 'empty') continue;
    const wellId = wellIdOf(well.row, well.col);
    const specimen = specimens.find((s) => s.plateWell === wellId);
    const minWriteRole: RoleId = specimen?.minWriteRole ?? 'analyst';
    const ctx: Ctx = {
      well, wellId, idx: well.row * 12 + well.col,
      assay: well.assay ?? 'wes',
      common: {
        consent: well.consentStatus ?? 'active',
        minWriteRole,
        specimenId: specimen?.id,
        patientCode: well.patientCode,
      },
    };
    const drafts = well.role !== 'sample' ? controlStack(ctx) : (CURATED[wellId] ?? genericStack)(ctx);
    drafts.forEach((d, seq) => out.push({ ...d, id: resultIdOf(wellId, seq), wellId, seq }));
  }
  return out;
}

/** Groups results by anchor well, ordered from the plate outward. */
export function groupResultsByWell(results: ReadonlyArray<WellResult>): ReadonlyMap<string, ReadonlyArray<WellResult>> {
  const map = new Map<string, WellResult[]>();
  for (const r of results) {
    const list = map.get(r.wellId);
    if (list) list.push(r); else map.set(r.wellId, [r]);
  }
  for (const list of map.values()) list.sort((a, b) => a.seq - b.seq);
  return map;
}

export const RESULT_KIND_LABEL: Record<ResultKind, string> = {
  primary: 'Primary',
  top_up: 'Top-up',
  reprep: 'Re-prep',
  reanalysis: 'Reanalysis',
  longitudinal: 'Longitudinal',
  matched_normal: 'Matched normal',
  orthogonal: 'Orthogonal',
  reflex: 'Reflex',
  control: 'Control',
};
