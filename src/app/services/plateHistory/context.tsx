import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Well } from '../../types';
import { HistoryAccessDenied, HistorySourceUnavailable, readPlateHistory } from './read';
import { requestLatestHistory } from './request';
import { useSessionResource } from '../browserSessionContext';
import { usePermissionScope } from '../permissionScenario';
import { scenarioInput } from '../permissionScope';
import { canReadResult, canReadWell } from '../../../../shared/permission-scope.mjs';
import { PLATE_OWNERSHIP, PLATE_WELLS } from './ownership';
import { historyKey, isPlateTarget, resolvePlateResult, type PlateTarget, type ResultStacks } from './records';
import { createHistoryCache, cacheFor, canonicalWell, projectScopedPlate, publishScopedHistory, type HistoryCacheStore } from './cache';

const HistoryCache = createContext<HistoryCacheStore | null>(null);
const HISTORY_CACHE = { create: createHistoryCache };

/** Read partitions follow policy scope; accepted edits keep their independent session owner. */
export function PlateHistoryProvider({ children }: { children: ReactNode }) {
  const cache = useSessionResource(HISTORY_CACHE);
  return <HistoryCache.Provider value={cache}>{children}</HistoryCache.Provider>;
}
export type HistoryPhase = 'idle' | 'loading' | 'ready' | 'unavailable' | 'denied';
interface HistoryState { key:string; scopeKey:string; phase:Exclude<HistoryPhase,'idle'>; }
function useHistoryCache() {
  const cache = useContext(HistoryCache);
  if (!cache) throw new Error('Plate history requires its workspace provider');
  return cache;
}

/** Current cached anchor for command ownership; missing and denied reads have no fallback. */
export function usePlateWellResolver(plateId: string, wells: readonly Well[] = PLATE_WELLS) {
  const cache = useHistoryCache();
  const { getScope } = usePermissionScope();
  return useCallback((wellId: string) => {
    if (typeof wellId !== 'string') return undefined;
    const scope = getScope();
    const partition = cacheFor(cache, scope.key);
    if (partition.blocked.has(historyKey(plateId, wellId))) return undefined;
    const anchor = canonicalWell(plateId, wellId, wells, partition);
    return anchor && canReadWell(scope, anchor, PLATE_OWNERSHIP).ok ? anchor : undefined;
  }, [plateId, wells, cache, getScope]);
}

/** Command lookup uses the current scope even when a former render captured this callback. */
export function usePlateResultResolver(plateId: string, examples: ResultStacks, wells: readonly Well[] = PLATE_WELLS) {
  const cache = useHistoryCache();
  const { getScope } = usePermissionScope();
  return useCallback((target: PlateTarget) => {
    if (!isPlateTarget(target)) return undefined;
    const scope = getScope();
    const partition = cacheFor(cache, scope.key);
    if (partition.blocked.has(historyKey(plateId, target.wellId))) return undefined;
    const anchor = canonicalWell(plateId, target.wellId, wells, partition);
    if (!anchor || !canReadWell(scope, anchor, PLATE_OWNERSHIP).ok) return undefined;
    const result = resolvePlateResult(target, plateId, examples, partition.histories);
    return result && canReadResult(scope, result, PLATE_OWNERSHIP, anchor).ok ? result : undefined;
  }, [plateId, examples, wells, cache, getScope]);
}

export function usePlateHistory(plateId: string, wellId: string | null, active: boolean, examples: ResultStacks, wells: readonly Well[] = PLATE_WELLS) {
  const cache = useHistoryCache();
  const { scope, getScope } = usePermissionScope();
  const scopeKey = scope.key;
  const partition = cacheFor(cache, scopeKey);
  const revision = useSyncExternalStore(partition.subscribe, partition.getSnapshot);
  const key = historyKey(plateId, wellId ?? '');
  const [state, setState] = useState<HistoryState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const selectedWell = wellId ? canonicalWell(plateId, wellId, wells, partition) : undefined;
  const denied = !!wellId && ((!!selectedWell && !canReadWell(scope, selectedWell, PLATE_OWNERSHIP).ok) || partition.blocked.get(key) === 'denied');

  useEffect(() => {
    if (!active || !wellId || denied) return;
    if (partition.histories.has(key)) { setState({ key, scopeKey, phase: 'ready' }); return; }
    setState({ key, scopeKey, phase: 'loading' });
    return requestLatestHistory(async signal => {
      try { return { kind: 'ready' as const, history: await readPlateHistory(plateId, wellId, signal, scenarioInput(scope)) }; }
      catch (error) {
        if (error instanceof HistoryAccessDenied) return { kind: 'denied' as const };
        if (error instanceof HistorySourceUnavailable) return { kind: 'unavailable' as const };
        throw error;
      }
    }, result => {
      const phase = publishScopedHistory(partition, key, scopeKey, getScope().key, result);
      if (phase) setState({ key, scopeKey, phase });
    });
  }, [active, plateId, wellId, key, scopeKey, scope, partition, denied, getScope, attempt]);

  const projected = useMemo(() => projectScopedPlate(scope, plateId, wells, examples, partition, PLATE_OWNERSHIP), [scope, plateId, wells, examples, partition, revision]);
  const current = state?.key === key && state.scopeKey === scopeKey ? state : null;
  const history = denied || !wellId ? undefined : projected.historyFor(wellId);
  const phase: HistoryPhase = denied ? 'denied' : !active || !wellId ? 'idle' : history ? 'ready' : current?.phase ?? partition.blocked.get(key) ?? 'loading';
  const retry = () => {
    if (getScope().key !== scopeKey || denied) return;
    partition.retry(key);
    setState({ key, scopeKey, phase: 'loading' });
    setAttempt(value => value + 1);
  };
  const sourceFor = (id: string | null) => {
    const sourceKey = historyKey(plateId, id ?? '');
    const well = id ? canonicalWell(plateId, id, wells, partition) : undefined;
    const deniedSource = !!id && ((!!well && !canReadWell(scope, well, PLATE_OWNERSHIP).ok) || partition.blocked.get(sourceKey) === 'denied');
    const received = deniedSource || !id ? undefined : projected.historyFor(id);
    return { wellId: id, history: received, fallbackAllowed: !deniedSource && !partition.blocked.has(sourceKey), phase: (deniedSource ? 'denied' : received ? 'ready' : id === wellId ? phase : partition.blocked.get(sourceKey) ?? 'idle') as HistoryPhase, retry };
  };
  return { wells: projected.wells, stacks: projected.stacks, history, phase, retry, sourceFor, scopeKey, fallbackAllowed: !denied && !partition.blocked.has(key) };
}
