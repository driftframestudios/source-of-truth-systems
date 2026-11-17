// ============================================================
// Data availability — the "no DevOps degree required" layer.
//
// Translates S3 storage classes, lifecycle-rule age, Glacier
// restore state, and Athena partition coverage into plain
// answers a genomics scientist can act on: can I open the VCF
// now, what happens if I pull the full BAM, can I query this
// sample. Pure functions only; views own presentation.
// ============================================================

import type {
  ArtifactKind, LifecycleRule, LifecycleRuleId, ResultArtifact, RestoreTier,
  StorageClassId, WellResult,
} from '../types';
import type { RoleId } from '../types/access';
import { LIFECYCLE_RULES, RESULTS_AS_OF, RESULTS_NOW_ISO } from '../data/wellResults';
import { isConsentHold } from './accessService';

// ---- storage classes ------------------------------------------

export type AccessSpeed = 'instant' | 'hours' | 'days' | 'gone';

export interface StorageClassFacts {
  readonly id: StorageClassId;
  readonly label: string;
  readonly short: string;
  readonly color: string;
  readonly speed: AccessSpeed;
  readonly firstByte: string;
  readonly readFeePerGb: number;       // USD per GB read (instant classes)
  readonly metaphor: string;
}

export const STORAGE_CLASSES: Record<StorageClassId, StorageClassFacts> = {
  standard:            { id: 'standard', label: 'S3 Standard', short: 'Standard', color: '#34d399', speed: 'instant', firstByte: 'milliseconds', readFeePerGb: 0,
                         metaphor: 'On the bench — opens instantly.' },
  intelligent_tiering: { id: 'intelligent_tiering', label: 'S3 Intelligent-Tiering', short: 'Int-Tiering', color: '#2dd4bf', speed: 'instant', firstByte: 'milliseconds', readFeePerGb: 0,
                         metaphor: 'AWS shuffles it between shelves by how often it is read — still opens instantly, no read fee.' },
  standard_ia:         { id: 'standard_ia', label: 'S3 Standard-IA', short: 'Standard-IA', color: '#38bdf8', speed: 'instant', firstByte: 'milliseconds', readFeePerGb: 0.01,
                         metaphor: 'Back shelf — opens instantly, with a small per-GB read fee.' },
  glacier_ir:          { id: 'glacier_ir', label: 'S3 Glacier Instant Retrieval', short: 'Glacier IR', color: '#818cf8', speed: 'instant', firstByte: 'milliseconds', readFeePerGb: 0.03,
                         metaphor: 'Cold room with a fast door — opens instantly, but reads cost more.' },
  glacier_flexible:    { id: 'glacier_flexible', label: 'S3 Glacier Flexible Retrieval', short: 'Glacier Flexible', color: '#a78bfa', speed: 'hours', firstByte: 'after a restore — minutes to hours', readFeePerGb: 0.01,
                         metaphor: 'Off-site storage — it has to be requested back before anyone can open it.' },
  deep_archive:        { id: 'deep_archive', label: 'S3 Glacier Deep Archive', short: 'Deep Archive', color: '#c7d2fe', speed: 'days', firstByte: 'after a restore — 12 to 48 h', readFeePerGb: 0.02,
                         metaphor: 'Deep vault — 12 to 48 hours to bring it back.' },
  expired:             { id: 'expired', label: 'Deleted by lifecycle rule', short: 'Deleted', color: '#475569', speed: 'gone', firstByte: '—', readFeePerGb: 0,
                         metaphor: 'Deleted by policy — regenerate it from the copy of record.' },
};

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  qc: 'QC metrics', calls: 'Variant calls', vcf: 'VCF', gvcf: 'gVCF', idat: 'IDAT (array)', cram: 'CRAM', bam: 'BAM', fastq: 'FASTQ',
};

// ---- formatting --------------------------------------------------

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  const dp = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(dp)} ${units[i]}`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.01) return '< $0.01';
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}

export function formatHours(hours: number): string {
  if (hours < 1 / 60) return `${Math.max(1, Math.round(hours * 3600))} s`;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function ageDays(createdAt: string): number {
  return daysBetween(createdAt, RESULTS_AS_OF);
}

// ---- lifecycle -----------------------------------------------------

export function ruleById(id: LifecycleRuleId): LifecycleRule {
  return LIFECYCLE_RULES.find((r) => r.id === id) ?? LIFECYCLE_RULES[0];
}

export interface LifecycleSegment {
  readonly storageClass: StorageClassId;
  readonly fromDay: number;
  readonly toDay: number | null;
}

export interface LifecyclePosition {
  readonly rule: LifecycleRule;
  readonly ageDays: number;
  readonly current: StorageClassId;
  readonly sinceDay: number;
  readonly next?: { readonly storageClass: StorageClassId; readonly atDay: number; readonly inDays: number };
  readonly segments: ReadonlyArray<LifecycleSegment>;
}

export function lifecyclePosition(ruleId: LifecycleRuleId, age: number): LifecyclePosition {
  const rule = ruleById(ruleId);
  const segments: LifecycleSegment[] = rule.transitions.map((t, i) => ({
    storageClass: t.storageClass,
    fromDay: t.atDay,
    toDay: rule.transitions[i + 1]?.atDay ?? rule.expireAtDay ?? null,
  }));
  if (rule.expireAtDay != null) segments.push({ storageClass: 'expired', fromDay: rule.expireAtDay, toDay: null });
  const current = [...segments].reverse().find((s) => age >= s.fromDay) ?? segments[0];
  const nextSeg = segments.find((s) => s.fromDay > age);
  return {
    rule,
    ageDays: age,
    current: current.storageClass,
    sinceDay: current.fromDay,
    next: nextSeg ? { storageClass: nextSeg.storageClass, atDay: nextSeg.fromDay, inDays: nextSeg.fromDay - age } : undefined,
    segments,
  };
}

// ---- restores ------------------------------------------------------

export interface RestoreOption {
  readonly tier: RestoreTier;
  readonly label: string;
  readonly minHours: number;
  readonly maxHours: number;
  readonly usdPerGb: number;
  readonly caveat?: string;
}

export function restoreOptions(cls: StorageClassId, sizeBytes: number): ReadonlyArray<RestoreOption> {
  if (cls === 'glacier_flexible') {
    return [
      { tier: 'expedited', label: 'Expedited', minHours: 1 / 60, maxHours: 5 / 60, usdPerGb: 0.03,
        caveat: sizeBytes > 250e6 ? 'AWS quotes 1–5 min only for objects under 250 MB — this one is larger, so expect it to take longer.' : undefined },
      { tier: 'standard', label: 'Standard', minHours: 3, maxHours: 5, usdPerGb: 0.01 },
      { tier: 'bulk', label: 'Bulk', minHours: 5, maxHours: 12, usdPerGb: 0 },
    ];
  }
  if (cls === 'deep_archive') {
    return [
      { tier: 'standard', label: 'Standard', minHours: 12, maxHours: 12, usdPerGb: 0.02 },
      { tier: 'bulk', label: 'Bulk', minHours: 48, maxHours: 48, usdPerGb: 0.0025 },
    ];
  }
  return [];
}

export function restoreWindow(o: RestoreOption): string {
  if (o.maxHours < 1) return `${Math.round(o.minHours * 60)}–${Math.round(o.maxHours * 60)} min`;
  if (o.minHours === o.maxHours) return `≤ ${o.maxHours} h`;
  return `${o.minHours}–${o.maxHours} h`;
}

export function restoreCost(o: RestoreOption, sizeBytes: number): number {
  return (sizeBytes / 1e9) * o.usdPerGb;
}

// ---- artifact resolution ------------------------------------------

export type ArtifactState = 'instant' | 'restored' | 'restoring' | 'archived' | 'held' | 'expired';

export interface ResolvedArtifact {
  readonly artifact: ResultArtifact;
  readonly position: LifecyclePosition;
  readonly facts: StorageClassFacts;
  readonly state: ArtifactState;
  readonly readNow: boolean;
  readonly wait: string;
  readonly plain: string;
  readonly options: ReadonlyArray<RestoreOption>;
}

function clockLabel(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  const sameDay = iso.slice(0, 10) === RESULTS_NOW_ISO.slice(0, 10);
  return sameDay ? time : `${iso.slice(5, 10)} ${time}`;
}

export function isResultHeld(r: Pick<WellResult, 'consent' | 'status'>): boolean {
  return isConsentHold(r.consent) || r.status === 'held';
}

export function resolveArtifact(a: ResultArtifact, result: Pick<WellResult, 'consent' | 'status'>): ResolvedArtifact {
  const position = lifecyclePosition(a.ruleId, ageDays(a.createdAt));
  const facts = STORAGE_CLASSES[position.current];
  const options = restoreOptions(position.current, a.sizeBytes);
  const frozenFor = position.ageDays - position.sinceDay;
  const base = { artifact: a, position, facts, options };

  if (isResultHeld(result)) {
    return {
      ...base, state: 'held', readNow: false, wait: 'withheld',
      plain: `Withheld while consent is ${result.consent === 'active' ? 'under review' : result.consent}.${a.legalHold ? ' S3 Object Lock legal hold until purge review.' : ''}`,
    };
  }
  if (position.current === 'expired') {
    return { ...base, state: 'expired', readNow: false, wait: 'deleted', plain: `Deleted by ${position.rule.id} on day ${position.sinceDay}. ${position.rule.retentionNote ?? ''}`.trim() };
  }
  if (a.restore?.state === 'restored' && (!a.restore.expiresAt || a.restore.expiresAt >= RESULTS_AS_OF)) {
    return {
      ...base, state: 'restored', readNow: true, wait: 'now',
      plain: `A temporary restored copy is readable until ${a.restore.expiresAt ?? 'further notice'}; the original stays in ${facts.short}.`,
    };
  }
  if (a.restore?.state === 'in_progress') {
    const hoursLeft = a.restore.readyAt ? Math.max(0, (Date.parse(a.restore.readyAt) - Date.parse(RESULTS_NOW_ISO)) / 3_600_000) : null;
    return {
      ...base, state: 'restoring', readNow: false,
      wait: hoursLeft != null ? `≈ ${formatHours(hoursLeft)}` : 'restoring',
      plain: `${a.restore.tier[0].toUpperCase()}${a.restore.tier.slice(1)} restore requested — readable ${a.restore.readyAt ? `around ${clockLabel(a.restore.readyAt)}` : 'soon'}.`,
    };
  }
  if (facts.speed === 'instant') {
    const fee = facts.readFeePerGb > 0 ? ` Reading it all costs ≈ ${formatUsd((a.sizeBytes / 1e9) * facts.readFeePerGb)}.` : '';
    return { ...base, state: 'instant', readNow: true, wait: 'now', plain: `Opens instantly from ${facts.short}.${fee}` };
  }
  const std = options.find((o) => o.tier === 'standard');
  return {
    ...base, state: 'archived', readNow: false, wait: std ? restoreWindow(std) : 'restore',
    plain: `Frozen in ${facts.label} since day ${position.sinceDay} (${frozenFor} day${frozenFor === 1 ? '' : 's'} ago). Restore before opening.`,
  };
}

export function resolveResult(result: WellResult): ReadonlyArray<ResolvedArtifact> {
  return result.artifacts.map((a) => resolveArtifact(a, result));
}

/** The reads file that defines a result's "heavy data" posture: BAM, else CRAM, else IDAT. */
export function readsArtifact(resolved: ReadonlyArray<ResolvedArtifact>): ResolvedArtifact | undefined {
  return resolved.find((r) => r.artifact.kind === 'bam')
    ?? resolved.find((r) => r.artifact.kind === 'cram')
    ?? resolved.find((r) => r.artifact.kind === 'idat');
}

/** Days until an instantly readable object freezes into a restore-only class, if within `horizon`. */
export function freezesWithin(r: ResolvedArtifact | undefined, horizon = 21): number | null {
  if (!r || r.state !== 'instant' || !r.position.next) return null;
  const nextSpeed = STORAGE_CLASSES[r.position.next.storageClass].speed;
  return nextSpeed !== 'instant' && r.position.next.inDays <= horizon ? r.position.next.inDays : null;
}

export interface StackPullPlan {
  readonly files: number;
  readonly readyNow: number;
  readonly frozen: number;
  readonly restoring: number;
  readonly withheld: number;
  readonly totalBytes: number;
  readonly restoreWindow?: string;
  readonly restoreUsd: number;
  readonly download: string;
}

/**
 * What pulling every BAM in a stack costs — the longitudinal-study question.
 * Shared objects (reanalyses that point at an earlier BAM) are counted once.
 */
export function stackPullPlan(stack: ReadonlyArray<WellResult>): StackPullPlan | null {
  const seen = new Set<string>();
  const bams: ResolvedArtifact[] = [];
  let withheld = 0;
  for (const r of stack) {
    const a = r.artifacts.find((x) => x.kind === 'bam');
    if (!a || seen.has(a.key)) continue;
    seen.add(a.key);
    if (isResultHeld(r)) { withheld++; continue; }
    bams.push(resolveArtifact(a, r));
  }
  if (bams.length + withheld < 2) return null;
  const frozen = bams.filter((b) => b.state === 'archived');
  const standardRestores = frozen.map((b) => b.options.find((o) => o.tier === 'standard')).filter((o): o is RestoreOption => !!o);
  const slowest = standardRestores.sort((a, b) => b.maxHours - a.maxHours)[0];
  const totalBytes = bams.reduce((n, b) => n + b.artifact.sizeBytes, 0);
  return {
    files: bams.length,
    readyNow: bams.filter((b) => b.readNow).length,
    frozen: frozen.length,
    restoring: bams.filter((b) => b.state === 'restoring').length,
    withheld,
    totalBytes,
    restoreWindow: slowest ? restoreWindow(slowest) : undefined,
    restoreUsd: frozen.reduce((n, b) => {
      const o = b.options.find((x) => x.tier === 'standard');
      return n + (o ? restoreCost(o, b.artifact.sizeBytes) : 0);
    }, 0),
    download: formatHours(totalBytes / 125e6 / 3600),
  };
}

// ---- downloads -------------------------------------------------------

export type DownloadScale = 'small' | 'large' | 'huge' | 'massive';

export interface DownloadEstimate {
  readonly scale: DownloadScale;
  readonly at1Gbps: string;
  readonly at100Mbps: string;
  readonly egressUsd: number;
}

export function downloadEstimate(bytes: number): DownloadEstimate {
  const scale: DownloadScale = bytes >= 1e12 ? 'massive' : bytes >= 250e9 ? 'huge' : bytes >= 5e9 ? 'large' : 'small';
  return {
    scale,
    at1Gbps: formatHours(bytes / 125e6 / 3600),
    at100Mbps: formatHours(bytes / 12.5e6 / 3600),
    egressUsd: (bytes / 1e9) * 0.09,
  };
}

// ---- Athena ----------------------------------------------------------

export const ATHENA_PROJECTION_START = '2025-07-01';
export const LAKE_GLACIER_AFTER_DAYS = 540;

export type AthenaState = 'ready' | 'repair' | 'rebuild' | 'excluded' | 'pending' | 'restricted';

export interface AthenaOverlay {
  readonly state: 'running' | 'done';
  readonly etaLabel?: string;
}

export interface AthenaPosture {
  readonly state: AthenaState;
  readonly table: string;
  readonly headline: string;
  readonly explanation: string;
  readonly silentRisk?: string;
  readonly scan?: string;
  readonly running?: boolean;
  readonly action?: {
    readonly kind: 'repair' | 'rebuild';
    readonly label: string;
    readonly sql: string;
    readonly eta: string;
    readonly cost: string;
    readonly minWriteRole: RoleId;
  };
}

export const ATHENA_COLOR: Record<AthenaState, string> = {
  ready: '#34d399', repair: '#f59e0b', rebuild: '#fb923c', excluded: '#fb7185', pending: '#64748b', restricted: '#94a3b8',
};

export const ATHENA_LABEL: Record<AthenaState, string> = {
  ready: 'Queryable', repair: 'Partition repair', rebuild: 'Restore + rebuild', excluded: 'Excluded', pending: 'Not loaded', restricted: 'Outside scope',
};

export function athenaPosture(result: WellResult, overlay?: AthenaOverlay): AthenaPosture {
  const calls = result.artifacts.find((a) => a.kind === 'vcf') ?? result.artifacts.find((a) => a.kind === 'calls');
  if (isResultHeld(result) || result.status === 'cancelled') {
    return {
      state: 'excluded', table: 'genomics.variants_v3', headline: 'Excluded by Lake Formation',
      explanation: `A Lake Formation row filter (consent_status = 'active') removes this subject from every query — by design, while consent is ${result.consent}.`,
    };
  }
  if (!calls && result.artifactsRestricted) {
    return { state: 'restricted', table: 'genomics.variants_v3', headline: 'Query availability outside scope',
      explanation: 'This scenario does not expose the files needed to determine query availability.' };
  }
  if (!calls || result.status === 'in_progress' || result.status === 'failed_qc') {
    return {
      state: 'pending', table: 'genomics.variants_v3', headline: 'Not in the lake',
      explanation: result.status === 'failed_qc'
        ? 'Results that fail a release gate are never loaded into the query lake, so they cannot leak into cohort counts.'
        : 'Rows land in the lake once variant calls are released for this result.',
    };
  }
  const scanBytes = Math.max(10e6, calls.sizeBytes * 0.35);
  const scan = `≈ ${formatBytes(scanBytes)} scanned · ${formatUsd((scanBytes / 1e12) * 5)}`;

  if (result.runDate >= ATHENA_PROJECTION_START || overlay?.state === 'done') {
    return {
      state: 'ready', table: result.runDate >= ATHENA_PROJECTION_START ? 'genomics.variants_v3' : 'genomics.variants_legacy',
      headline: overlay?.state === 'done' ? 'Queryable — repaired this session' : 'Queryable now',
      explanation: result.runDate >= ATHENA_PROJECTION_START
        ? `Partition projection covers run_date=${result.runDate} and the Parquet rows sit in S3 Standard, so queries see this sample immediately.`
        : `The legacy partition for run_date=${result.runDate} was reconstructed, so queries now return this sample.`,
      scan,
    };
  }

  const lakeAge = daysBetween(result.runDate, RESULTS_AS_OF);
  if (lakeAge > LAKE_GLACIER_AFTER_DAYS) {
    return {
      state: 'rebuild', table: 'genomics.variants_legacy',
      headline: overlay?.state === 'running' ? 'Restore + rebuild running' : 'Needs restore + table rebuild',
      explanation: `This run predates the v3 table (${ATHENA_PROJECTION_START}) and its Parquet aged past ${LAKE_GLACIER_AFTER_DAYS} days, so it moved to S3 Glacier Flexible Retrieval. Athena skips Glacier objects without raising an error, so the partition reads as empty until the objects are restored and the table is rebuilt.`,
      silentRisk: 'Today a query returns 0 rows for this sample — and no error.',
      running: overlay?.state === 'running',
      action: {
        kind: 'rebuild', label: 'Restore + rebuild',
        sql: `CREATE TABLE genomics.variants_restored AS\nSELECT * FROM genomics.variants_legacy\nWHERE run_date = DATE '${result.runDate}';`,
        eta: overlay?.etaLabel ?? '3–5 h restore + ≈ 20 min CTAS',
        cost: `${formatUsd((calls.sizeBytes * 0.4 / 1e9) * 0.01)} restore + ${formatUsd((scanBytes / 1e12) * 5)} scan`,
        minWriteRole: 'analyst',
      },
    };
  }
  return {
    state: 'repair', table: 'genomics.variants_legacy',
    headline: overlay?.state === 'running' ? 'Partition repair running' : 'Needs partition repair',
    explanation: `Runs before ${ATHENA_PROJECTION_START} live in the legacy Hive-partitioned table. Its Glue crawler was retired at the v3 migration, so the partition for run_date=${result.runDate} is not registered and Athena cannot see it until the partition metadata is reconstructed.`,
    silentRisk: 'Today a query returns 0 rows for this sample — and no error.',
    running: overlay?.state === 'running',
    action: {
      kind: 'repair', label: 'Repair partition',
      sql: `ALTER TABLE genomics.variants_legacy\nADD IF NOT EXISTS PARTITION (run_date = '${result.runDate}');`,
      eta: overlay?.etaLabel ?? '≈ 1–2 min',
      cost: 'metadata only · $0',
      minWriteRole: 'analyst',
    },
  };
}

// ---- plain-language answers --------------------------------------------

export type Verdict = 'yes' | 'wait' | 'caution' | 'no' | 'na';

export interface ReadinessAnswer {
  readonly id: 'calls' | 'bam' | 'athena';
  readonly question: string;
  readonly verdict: Verdict;
  readonly headline: string;
  readonly detail: string;
}

export function readinessAnswers(
  result: WellResult,
  resolved: ReadonlyArray<ResolvedArtifact>,
  athena: AthenaPosture,
  region: string,
  labelOf: (resultId: string) => string = (id) => id.replace(/^RES-/, ''),
): ReadonlyArray<ReadinessAnswer> {
  const held = isResultHeld(result);
  const light = resolved.filter((r) => ['qc', 'calls', 'vcf', 'idat'].includes(r.artifact.kind));
  const callsish = light.filter((r) => r.artifact.kind !== 'qc');
  const answers: ReadinessAnswer[] = [];

  // 1 — light-weight results: VCF, calls, QC.
  if (held) {
    answers.push({ id: 'calls', question: 'Can I open the variant calls and QC?', verdict: 'no', headline: 'Withheld', detail: `Consent is ${result.consent}; nothing from this result may be analyzed.` });
  } else if (callsish.length === 0 && result.artifactsRestricted) {
    answers.push({ id: 'calls', question: 'Can I open the variant calls and QC?', verdict: 'na', headline: 'File details outside scope', detail: 'This scenario shows permitted files. Hidden files have no reported availability here.' });
  } else if (callsish.length === 0) {
    answers.push({
      id: 'calls', question: 'Can I open the variant calls and QC?', verdict: 'na', headline: 'Not produced yet',
      detail: result.status === 'in_progress' ? 'This result is still in progress — calls appear when the pipeline releases them.' : 'This result stopped before variant calling.',
    });
  } else {
    const slow = callsish.filter((r) => !r.readNow);
    const list = light.map((r) => `${ARTIFACT_LABEL[r.artifact.kind]} ${formatBytes(r.artifact.sizeBytes)}`).join(' · ');
    answers.push(slow.length === 0
      ? { id: 'calls', question: result.artifactsRestricted ? 'Can I open the permitted calls and QC?' : 'Can I open the variant calls and QC?', verdict: 'yes', headline: 'Yes — instantly', detail: `${list}. Lifecycle keeps these hot, so no restore is ever needed.` }
      : { id: 'calls', question: result.artifactsRestricted ? 'Can I open the permitted calls and QC?' : 'Can I open the variant calls and QC?', verdict: 'wait', headline: `Wait ${slow[0].wait}`, detail: slow[0].plain });
  }

  // 2 — the heavy reads file.
  const bam = resolved.find((r) => r.artifact.kind === 'bam');
  const cram = resolved.find((r) => r.artifact.kind === 'cram');
  if (held) {
    answers.push({ id: 'bam', question: 'What happens if I pull the full BAM?', verdict: 'no', headline: 'Blocked by consent hold', detail: bam?.artifact.legalHold ? 'The BAM is under an Object Lock legal hold pending purge review.' : 'Reads may not leave the hold.' });
  } else if (!bam && result.artifactsRestricted) {
    answers.push({ id: 'bam', question: 'What happens if I pull the full BAM?', verdict: 'na', headline: 'BAM availability outside scope', detail: 'The visible file list cannot establish whether an aligned reads file is available.' });
  } else if (!bam) {
    answers.push({
      id: 'bam', question: 'What happens if I pull the full BAM?', verdict: 'na',
      headline: result.artifacts.some((a) => a.kind === 'idat') ? 'Array assay — no BAM' : 'No BAM for this result',
      detail: result.artifacts.some((a) => a.kind === 'idat') ? 'Methylation arrays produce IDAT files (MBs), not aligned reads.' : result.status === 'in_progress' ? 'Reads have not been aligned yet.' : 'No aligned reads were produced.',
    });
  } else {
    const est = downloadEstimate(bam.artifact.sizeBytes);
    const size = formatBytes(bam.artifact.sizeBytes);
    const reused = bam.artifact.reusedFrom ? ` It is the same object as ${labelOf(bam.artifact.reusedFrom)}'s BAM — no new reads were made.` : '';
    const cramTip = cram && cram.readNow ? ` Stream a locus from the ${formatBytes(cram.artifact.sizeBytes)} CRAM instead — it is readable now.` : '';
    if (!bam.readNow) {
      answers.push({
        id: 'bam', question: 'What happens if I pull the full BAM?', verdict: est.scale === 'massive' ? 'caution' : 'wait',
        headline: `${size}${est.scale === 'massive' ? ' · multi-terabyte' : ''} · ${bam.state === 'restoring' ? `restoring, ${bam.wait}` : `restore first (${bam.wait})`}`,
        detail: `${bam.plain}${reused} After the restore, a full download takes ≈ ${est.at1Gbps} at 1 Gbps.${cramTip}`,
      });
    } else {
      answers.push({
        id: 'bam', question: 'What happens if I pull the full BAM?', verdict: est.scale === 'massive' || est.scale === 'huge' ? 'caution' : 'yes',
        headline: `${size}${est.scale === 'massive' ? ' · multi-terabyte' : ''} · readable now`,
        detail: `Full download ≈ ${est.at1Gbps} at 1 Gbps (${est.at100Mbps} at 100 Mbps).${reused} Outside ${region} that is ≈ ${formatUsd(est.egressUsd)} egress; inside ${region} it is free. IGV range requests stream just the locus you view.`,
      });
    }
  }

  // 3 — Athena.
  answers.push({
    id: 'athena', question: 'Can I query this sample in Athena?',
    verdict: athena.state === 'ready' ? 'yes' : athena.state === 'excluded' ? 'no' : athena.state === 'pending' || athena.state === 'restricted' ? 'na' : 'wait',
    headline: athena.headline,
    detail: athena.silentRisk ? `${athena.silentRisk} ${athena.action ? `${athena.action.label}: ${athena.action.eta}.` : ''}`.trim() : athena.explanation,
  });
  return answers;
}

/** One-line plain-language summary for a result's data posture. */
export function availabilitySummary(result: WellResult, resolved: ReadonlyArray<ResolvedArtifact>): string {
  if (isResultHeld(result)) return `Everything from this result is withheld while consent is ${result.consent}.`;
  if (result.artifactsRestricted) return resolved.length ? 'Showing permitted files; other file details are outside this scope.' : 'File availability is outside this scenario’s scope.';
  if (resolved.length === 0) return result.status === 'in_progress' ? 'No files yet — this result is still in progress.' : 'This result produced no data files.';
  const light = resolved.filter((r) => ['qc', 'calls', 'vcf', 'gvcf', 'idat'].includes(r.artifact.kind));
  const lightNow = light.every((r) => r.readNow);
  const reads = readsArtifact(resolved);
  const hasCalls = light.some((r) => r.artifact.kind !== 'qc');
  const lightPart = !light.length
    ? ''
    : !hasCalls
    ? 'Only QC metrics so far — they open instantly; calls arrive when the pipeline releases them.'
    : lightNow ? 'Calls and QC open instantly.' : 'Some light files need a restore.';
  if (!reads) return lightPart || 'Only QC metrics so far.';
  const name = ARTIFACT_LABEL[reads.artifact.kind];
  const size = formatBytes(reads.artifact.sizeBytes);
  if (reads.state === 'archived') {
    const ago = reads.position.ageDays - reads.position.sinceDay;
    return `${lightPart} The ${size} ${name} froze into ${reads.facts.short} ${ago} day${ago === 1 ? '' : 's'} ago — restore takes ${reads.wait}.`.trim();
  }
  if (reads.state === 'restoring') return `${lightPart} The ${size} ${name} is being restored (${reads.wait}).`.trim();
  if (reads.state === 'restored') return `${lightPart} The ${size} ${name} has a temporary restored copy — readable now.`.trim();
  const nxt = reads.position.next;
  const soon = nxt && nxt.inDays <= 21 && STORAGE_CLASSES[nxt.storageClass].speed !== 'instant'
    ? ` Heads-up: it freezes into ${STORAGE_CLASSES[nxt.storageClass].short} in ${nxt.inDays} day${nxt.inDays === 1 ? '' : 's'}.`
    : '';
  return `${lightPart} The ${size} ${name} is readable now.${soon}`.trim();
}
