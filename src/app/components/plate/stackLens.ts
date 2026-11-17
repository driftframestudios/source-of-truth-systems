// ============================================================
// Stack lenses — how result discs are painted in the upright view.
//   status  · which result is the source of truth
//   kind    · why each result exists (rerun, re-prep, draw …)
//   storage · where the reads live (BAM → CRAM → IDAT)
//   athena  · whether the sample is queryable today
// ============================================================

import type { ResultKind, ResultStatus, StorageClassId, WellResult } from '../../types';
import type { ArtifactState, AthenaState, ResolvedArtifact } from '../../services/dataAvailability';
import { ATHENA_COLOR, ATHENA_LABEL, STORAGE_CLASSES, freezesWithin, isResultHeld } from '../../services/dataAvailability';
import { RESULT_KIND_LABEL } from '../../data/wellResults';
import { shade } from './plateGeometry';
import type { ThemeMode } from '../../theme/theme';

export type StackLens = 'status' | 'kind' | 'storage' | 'athena';

export const LENS_OPTIONS: ReadonlyArray<{ id: StackLens; label: string; hint: string }> = [
  { id: 'status', label: 'Status', hint: 'Which result is the source of truth' },
  { id: 'kind', label: 'Why', hint: 'Why each result exists — rerun, re-prep, reanalysis, longitudinal draw' },
  { id: 'storage', label: 'Storage', hint: 'Where the reads live today — instant, frozen, or restoring' },
  { id: 'athena', label: 'Query', hint: 'Whether the sample can be queried in Athena today' },
];

export const STATUS_COLOR: Record<ResultStatus, string> = {
  reportable: '#2dd4bf',
  superseded: '#64748b',
  failed_qc: '#f87171',
  in_progress: '#38bdf8',
  held: '#fb7185',
  cancelled: '#475569',
  informational: '#a3b1c6',
};

export const STATUS_LABEL: Record<ResultStatus, string> = {
  reportable: 'Reportable · SoT',
  superseded: 'Superseded',
  failed_qc: 'Failed QC',
  in_progress: 'In progress',
  held: 'Held · consent',
  cancelled: 'Cancelled',
  informational: 'Informational',
};

export const KIND_COLOR: Record<ResultKind, string> = {
  primary: '#e8d36a',
  top_up: '#f59e0b',
  reprep: '#fb923c',
  reanalysis: '#a78bfa',
  longitudinal: '#38bdf8',
  matched_normal: '#94a3b8',
  orthogonal: '#34d399',
  reflex: '#f472b6',
  control: '#cbd5e1',
};

export type DiscPattern = 'frost' | 'deep_frost' | 'hatch' | 'hollow' | 'dot' | 'bar';

export interface DiscPaint {
  readonly base: string;
  readonly pattern?: DiscPattern;
  /** A cross-lens quality cue; storage texture remains visible beneath it. */
  readonly mark?: 'failed_qc';
  readonly pulse?: boolean;
  readonly faded?: boolean;
  readonly sot?: boolean;
  /** Outer warning ring, e.g. "freezes into Glacier soon". */
  readonly ring?: string;
}

// Domain hues are shared across lenses. Keep their High contrast projection and
// redundant face cues together so the well, record companion and key agree.
const CONTRAST_CATEGORY_CUES = new Map<string, Pick<DiscPaint, 'base' | 'pattern'>>([
  [KIND_COLOR.orthogonal, { base: '#ffd166', pattern: 'dot' }],
  [KIND_COLOR.reanalysis, { base: '#87c9ff', pattern: 'bar' }],
]);
const CONTRAST_MARK_INK = '#06101d';

export const FREEZE_SOON_COLOR = '#fbbf24';

export interface DiscFacts {
  readonly reads?: ResolvedArtifact;
  readonly athena: AthenaState;
}

function storageKey(reads?: ResolvedArtifact): { cls: StorageClassId | 'none'; state?: ArtifactState } {
  if (!reads) return { cls: 'none' };
  return { cls: reads.position.current, state: reads.state };
}

function baseDiscPaint(r: WellResult, lens: StackLens, facts: DiscFacts): DiscPaint {
  const sot = r.status === 'reportable';
  const hollow = r.status === 'cancelled';
  const hatch = r.status === 'held';
  const base = { sot, faded: r.status === 'superseded' };
  if (hollow) return { ...base, base: STATUS_COLOR.cancelled, pattern: 'hollow' };
  switch (lens) {
    case 'status':
      return { ...base, base: STATUS_COLOR[r.status], pattern: hatch ? 'hatch' : undefined, pulse: r.status === 'in_progress' };
    case 'kind':
      return { ...base, base: KIND_COLOR[r.kind], pattern: hatch ? 'hatch' : undefined, pulse: r.status === 'in_progress' };
    case 'storage': {
      const { cls, state } = storageKey(facts.reads);
      if (hatch) return { ...base, base: STATUS_COLOR.held, pattern: 'hatch' };
      if (cls === 'none') return { ...base, base: '#334155' };
      if (state === 'restored') return { ...base, base: '#5eead4' };
      if (state === 'restoring') return { ...base, base: '#fbbf24', pulse: true };
      return {
        ...base,
        base: STORAGE_CLASSES[cls].color,
        pattern: cls === 'glacier_flexible' ? 'frost' : cls === 'deep_archive' ? 'deep_frost' : undefined,
        ring: freezesWithin(facts.reads) != null ? FREEZE_SOON_COLOR : undefined,
      };
    }
    case 'athena':
      return { ...base, base: ATHENA_COLOR[facts.athena], pattern: hatch ? 'hatch' : undefined };
  }
}

/** Preserve established modes; High contrast has a bounded category-pair override. */
export function plateColor(color: string, mode: ThemeMode = 'dark'): string {
  return mode === 'light' ? shade(color, -0.45) : mode === 'contrast' ? CONTRAST_CATEGORY_CUES.get(color)?.base ?? shade(color, 0.22) : color;
}

function platePattern(color: string, pattern: DiscPattern | undefined, mode: ThemeMode): DiscPattern | undefined {
  // Consent, cancellation and frozen-file patterns retain their established meaning.
  return pattern ?? (mode === 'contrast' ? CONTRAST_CATEGORY_CUES.get(color)?.pattern : undefined);
}

export function discPaint(r: WellResult, lens: StackLens, facts: DiscFacts, mode: ThemeMode = 'dark'): DiscPaint {
  const paint = baseDiscPaint(r, lens, facts);
  const failedQc = mode === 'contrast' && r.status === 'failed_qc' && !isResultHeld(r);
  return {
    ...paint,
    base: plateColor(paint.base, mode),
    pattern: failedQc ? paint.pattern : platePattern(paint.base, paint.pattern, mode),
    mark: failedQc ? 'failed_qc' : undefined,
    ring: paint.ring ? plateColor(paint.ring, mode) : undefined,
  };
}

/** CSS background for a disc face: glossy puck, plus a frost / hatch overlay when patterned. */
export function discBackground(p: DiscPaint): string {
  if (p.pattern === 'hollow') return 'transparent';
  const mark = p.mark === 'failed_qc'
    ? `linear-gradient(135deg, transparent calc(50% - 1.25px), ${CONTRAST_MARK_INK} calc(50% - 1.25px) calc(50% + 1.25px), transparent calc(50% + 1.25px)), `
    : '';
  const overlay =
    p.pattern === 'frost'
      ? 'repeating-linear-gradient(60deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 4px), '
      : p.pattern === 'deep_frost'
      ? 'repeating-linear-gradient(60deg, rgba(255,255,255,0.4) 0 1px, transparent 1px 3px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.3) 0 1px, transparent 1px 3px), '
      : p.pattern === 'hatch'
      ? 'repeating-linear-gradient(45deg, rgba(10,17,32,0.6) 0 2px, transparent 2px 5px), '
      : p.pattern === 'dot'
      ? `radial-gradient(circle at center, ${CONTRAST_MARK_INK} 0 2px, transparent 2.5px), `
      : p.pattern === 'bar'
      ? `radial-gradient(ellipse 6px 1.5px at center, ${CONTRAST_MARK_INK} 80%, transparent 100%), `
      : '';
  return `${mark}${overlay}radial-gradient(circle at 34% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0) 44%), radial-gradient(circle at 50% 55%, ${p.base} 0%, ${shade(p.base, -0.32)} 100%)`;
}

export interface LegendItem {
  readonly color: string;
  readonly label: string;
  readonly pattern?: DiscPattern;
  readonly mark?: DiscPaint['mark'];
  readonly ring?: string;
}

function baseLegendFor(lens: StackLens): ReadonlyArray<LegendItem> {
  switch (lens) {
    case 'status':
      return (['reportable', 'superseded', 'failed_qc', 'in_progress', 'informational', 'held', 'cancelled'] as const).map((s) => ({
        color: STATUS_COLOR[s], label: STATUS_LABEL[s], pattern: s === 'held' ? 'hatch' : s === 'cancelled' ? 'hollow' : undefined,
        mark: s === 'failed_qc' ? 'failed_qc' : undefined,
      }));
    case 'kind':
      return [...(['primary', 'top_up', 'reprep', 'reanalysis', 'longitudinal', 'matched_normal', 'orthogonal', 'reflex', 'control'] as const).map((k) => ({
        color: KIND_COLOR[k], label: RESULT_KIND_LABEL[k],
      })), { color: '#94a3b8', label: 'Hatching · consent hold', pattern: 'hatch' }, { color: STATUS_COLOR.cancelled, label: 'Cancelled', pattern: 'hollow' }];
    case 'storage':
      return [
        { color: STORAGE_CLASSES.standard.color, label: 'Standard · now' },
        { color: STORAGE_CLASSES.intelligent_tiering.color, label: 'Int-Tiering · now' },
        { color: STORAGE_CLASSES.intelligent_tiering.color, label: 'Freezes ≤ 21 d', ring: FREEZE_SOON_COLOR },
        { color: STORAGE_CLASSES.glacier_ir.color, label: 'Glacier IR · now' },
        { color: STORAGE_CLASSES.glacier_flexible.color, label: 'Glacier Flexible · 3–5 h', pattern: 'frost' },
        { color: STORAGE_CLASSES.deep_archive.color, label: 'Deep Archive · ≤ 48 h', pattern: 'deep_frost' },
        { color: '#fbbf24', label: 'Restoring' },
        { color: '#5eead4', label: 'Restored copy' },
        { color: '#334155', label: 'No visible reads file' },
        { color: STATUS_COLOR.held, label: 'Held · consent', pattern: 'hatch' },
        { color: STATUS_COLOR.cancelled, label: 'Cancelled', pattern: 'hollow' },
      ];
    case 'athena':
      return [...(['ready', 'repair', 'rebuild', 'excluded', 'pending', 'restricted'] as const).map((s) => ({ color: ATHENA_COLOR[s], label: ATHENA_LABEL[s] })), { color: ATHENA_COLOR.excluded, label: 'Hatching · consent hold', pattern: 'hatch' }, { color: STATUS_COLOR.cancelled, label: 'Cancelled', pattern: 'hollow' }];
  }
}

export function legendFor(lens: StackLens, mode: ThemeMode = 'dark'): ReadonlyArray<LegendItem> {
  const items = baseLegendFor(lens);
  const withQuality: ReadonlyArray<LegendItem> = mode === 'contrast' && lens !== 'status'
    ? [...items, { color: STATUS_COLOR.failed_qc, label: 'Diagonal · failed QC', mark: 'failed_qc' }]
    : items;
  return withQuality.map((item) => ({
    ...item,
    color: plateColor(item.color, mode),
    pattern: platePattern(item.color, item.pattern, mode),
    mark: mode === 'contrast' ? item.mark : undefined,
    ring: item.ring ? plateColor(item.ring, mode) : undefined,
  }));
}
