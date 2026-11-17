import { overlayValue } from './plateOverlayState';
import type { WellResult } from '../../types';
import { STORAGE_CLASSES, athenaPosture, freezesWithin, isResultHeld, readsArtifact, resolveResult } from '../../services/dataAvailability';
import type { AthenaOverlay, AthenaState, ResolvedArtifact } from '../../services/dataAvailability';

export interface ResultFacts {
  readonly reads?: ResolvedArtifact;
  readonly athena: AthenaState;
  readonly lightReady: boolean | null;
}

export interface PlatePostureStats {
  readonly results: number;
  readonly wells: number;
  readonly multiWells: number;
  readonly longitudinalSeries: number;
  readonly reruns: number;
  readonly reanalyses: number;
  readonly lightReadyPct: number;
  readonly readsByClass: ReadonlyArray<{ key: string; label: string; color: string; count: number; frozen: boolean }>;
  readonly readsFrozen: number;
  readonly readsTotal: number;
  readonly freezingSoon: number;
  readonly athena: ReadonlyArray<{ state: AthenaState; count: number }>;
}

export function plateFacts(stacks: ReadonlyMap<string, ReadonlyArray<WellResult>>, athena: Readonly<Record<string, AthenaOverlay>>): ReadonlyMap<string, ResultFacts> {
  const m = new Map<string, ResultFacts>();
  for (const list of stacks.values()) {
    for (const r of list) {
      const resolved = resolveResult(r);
      const light = resolved.filter((x) => x.artifact.kind === 'calls' || x.artifact.kind === 'vcf' || x.artifact.kind === 'idat');
      m.set(r.id, {
        reads: readsArtifact(resolved),
        athena: athenaPosture(r, overlayValue(athena, r.id)).state,
        lightReady: light.length && !isResultHeld(r) ? light.every((x) => x.readNow) : null,
      });
    }
  }
  return m;
}

export function platePosture(stacks: ReadonlyMap<string, ReadonlyArray<WellResult>>, facts: ReadonlyMap<string, ResultFacts>): PlatePostureStats {
  const lists = [...stacks.values()];
  const all = lists.flat();
  const light = all.map((r) => facts.get(r.id)?.lightReady).filter((v): v is boolean => v != null);
  const order = ['standard', 'intelligent_tiering', 'standard_ia', 'glacier_ir', 'restored', 'restoring', 'glacier_flexible', 'deep_archive', 'expired'];
  const buckets = new Map<string, number>();
  let frozen = 0;
  let total = 0;
  let freezingSoon = 0;
  for (const r of all) {
    const reads = facts.get(r.id)?.reads;
    if (!reads || isResultHeld(r)) continue;
    total++;
    if (reads.state === 'archived') frozen++;
    if (reads.artifact.kind === 'bam' && !reads.artifact.reusedFrom && freezesWithin(reads) != null) freezingSoon++;
    const key = reads.state === 'restoring' || reads.state === 'restored' ? reads.state : reads.position.current;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const athenaCounts = new Map<AthenaState, number>();
  for (const r of all) {
    const a = facts.get(r.id)?.athena ?? 'pending';
    athenaCounts.set(a, (athenaCounts.get(a) ?? 0) + 1);
  }
  return {
    results: all.length,
    wells: lists.length,
    multiWells: lists.filter((l) => l.length > 1).length,
    longitudinalSeries: lists.filter((l) => l.some((r) => r.kind === 'longitudinal')).length,
    reruns: all.filter((r) => r.kind === 'top_up' || r.kind === 'reprep').length,
    reanalyses: all.filter((r) => r.kind === 'reanalysis').length,
    lightReadyPct: Math.round((light.filter(Boolean).length / Math.max(1, light.length)) * 100),
    readsByClass: order.filter((k) => buckets.has(k)).map((k) => ({
      key: k,
      label: k === 'restoring' ? 'Restoring' : k === 'restored' ? 'Restored copy' : STORAGE_CLASSES[k as keyof typeof STORAGE_CLASSES].short,
      color: k === 'restoring' ? '#fbbf24' : k === 'restored' ? '#5eead4' : STORAGE_CLASSES[k as keyof typeof STORAGE_CLASSES].color,
      count: buckets.get(k)!,
      frozen: k === 'glacier_flexible' || k === 'deep_archive',
    })),
    readsFrozen: frozen,
    readsTotal: total,
    freezingSoon,
    athena: (['ready', 'repair', 'rebuild', 'excluded', 'pending', 'restricted'] as const).map((s) => ({ state: s, count: athenaCounts.get(s) ?? 0 })),
  };
}
