import type { WellResult } from '../../types';
import type { PlateHistory } from './read';

/** The collection plate anchors a history; each result may name another physical run plate. */
export interface PlateTarget {
  readonly plateId: string;
  readonly wellId: string;
  readonly resultId: string;
}

export type ResultStacks = ReadonlyMap<string, ReadonlyArray<WellResult>>;
export type PlateHistoryCache = ReadonlyMap<string, PlateHistory>;

export function isPlateTarget(value: unknown): value is PlateTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Record<string, unknown>;
  return ['plateId', 'wellId', 'resultId'].every((key) => typeof target[key] === 'string' && target[key] !== '');
}

export const historyKey = (plateId: string, wellId: string) => `${plateId}/${wellId}`;

/** A successful empty/missing history replaces examples just as a populated read does. */
export function projectPlateHistories(plateId: string, examples: ResultStacks, cache: PlateHistoryCache): ResultStacks {
  let projected: Map<string, ReadonlyArray<WellResult>> | undefined;
  const prefix = `${plateId}/`;
  for (const [key, history] of cache) {
    if (!key.startsWith(prefix)) continue;
    projected ??= new Map(examples);
    projected.set(key.slice(prefix.length), history.results);
  }
  return projected ?? examples;
}

export function resolvePlateResult(target: PlateTarget, plateId: string, examples: ResultStacks, cache: PlateHistoryCache): WellResult | undefined {
  if (!isPlateTarget(target)) return undefined;
  if (target.plateId !== plateId) return undefined;
  const history = cache.get(historyKey(plateId, target.wellId));
  const results = history ? history.results : examples.get(target.wellId);
  return results?.find((result) => result.id === target.resultId && result.wellId === target.wellId);
}
