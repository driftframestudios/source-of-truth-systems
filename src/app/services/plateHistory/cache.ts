import type { Well, WellResult } from "../../types";
import type {
  PermissionScope,
  RecordOwnership,
} from "../../../../shared/permission-scope.mjs";
import {
  canReadResult,
  canReadWell,
  projectResultFields,
  projectResultRelations,
  projectWellFields,
} from "../../../../shared/permission-scope.mjs";
import type { PlateHistory } from "./read";
import {
  historyKey,
  projectPlateHistories,
  type ResultStacks,
} from "./records";

export const HISTORY_CACHE_LIMITS = { scopes: 4 } as const;
export interface ScopeCache {
  readonly histories: ReadonlyMap<string, PlateHistory>;
  readonly blocked: ReadonlyMap<string, "denied" | "unavailable">;
  readonly active: boolean;
  readonly getSnapshot: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  readonly publish: (
    key: string,
    result: ReadReceipt,
  ) => "ready" | "denied" | "unavailable" | undefined;
  readonly retry: (key: string) => void;
  readonly retire: () => void;
}
function createPartition(): ScopeCache {
  const histories = new Map<string, PlateHistory>();
  const blocked = new Map<string, "denied" | "unavailable">();
  const listeners = new Set<() => void>();
  let revision = 0,
    active = true;
  const changed = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  const partition: ScopeCache = {
    histories,
    blocked,
    get active() {
      return active;
    },
    getSnapshot: () => revision,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(key, result) {
      if (!active) return;
      if ("error" in result) return "unavailable";
      if (result.value.kind !== "ready") {
        blocked.set(key, result.value.kind);
        histories.delete(key);
        changed();
        return result.value.kind;
      }
      blocked.delete(key);
      histories.set(key, result.value.history);
      changed();
      return "ready";
    },
    retry(key) {
      if (active) {
        histories.delete(key);
        changed();
      }
    },
    retire() {
      active = false;
      histories.clear();
      blocked.clear();
      projections.delete(partition);
      revision++;
      // Scope admission may happen during render; notify any former receiver after that turn.
      queueMicrotask(() => {
        for (const listener of listeners) listener();
      });
    },
  };
  return partition;
}
/** Current scope and three recent scopes. Retired partitions can never accept a late receipt. */
export function createHistoryCache() {
  const scopes = new Map<string, ScopeCache>();
  return {
    get size() {
      return scopes.size;
    },
    get retainedEntries() {
      return [...scopes.values()].reduce(
        (count, scope) => count + scope.histories.size + scope.blocked.size,
        0,
      );
    },
    forScope(key: string): ScopeCache {
      let partition = scopes.get(key);
      if (partition) scopes.delete(key);
      else {
        if (scopes.size >= HISTORY_CACHE_LIMITS.scopes) {
          const oldest = scopes.keys().next().value!;
          scopes.get(oldest)!.retire();
          scopes.delete(oldest);
        }
        partition = createPartition();
      }
      scopes.set(key, partition);
      return partition;
    },
  };
}
export type HistoryCacheStore = ReturnType<typeof createHistoryCache>;
export const cacheFor = (cache: HistoryCacheStore, scopeKey: string) =>
  cache.forScope(scopeKey);

export const wellCoordinate = (well: Pick<Well, "row" | "col">) =>
  `${"ABCDEFGH"[well.row]}${well.col + 1}`;

const coordinateIndexes = new WeakMap<
  readonly Well[],
  ReadonlyMap<string, Well>
>();
function coordinateIndex(wells: readonly Well[]): ReadonlyMap<string, Well> {
  let index = coordinateIndexes.get(wells);
  if (!index) {
    index = new Map(wells.map((well) => [wellCoordinate(well), well]));
    coordinateIndexes.set(wells, index);
  }
  return index;
}

/** A received well replaces the bundled metadata, including an explicitly missing well. */
export function canonicalWell(
  plateId: string,
  id: string,
  wells: readonly Well[],
  partition: ScopeCache,
): Well | undefined {
  const history = partition.histories.get(historyKey(plateId, id));
  return history ? (history.well ?? undefined) : coordinateIndex(wells).get(id);
}

type ReadReceipt =
  | {
      value:
        | { kind: "ready"; history: PlateHistory }
        | { kind: "denied" | "unavailable" };
    }
  | { error: true };
export function publishScopedHistory(
  partition: ScopeCache,
  key: string,
  capturedScopeKey: string,
  currentScopeKey: string,
  result: ReadReceipt,
) {
  if (capturedScopeKey !== currentScopeKey || !partition.active)
    return undefined;
  return partition.publish(key, result);
}

/** One current-scope projection supplies geometry, metadata, counts and relationship targets. */
function buildScopedPlate(
  scope: PermissionScope,
  plateId: string,
  wells: readonly Well[],
  examples: ResultStacks,
  partition: ScopeCache,
  ownership: RecordOwnership,
) {
  const histories = new Map(partition.histories);
  const blocked = new Map(partition.blocked);
  const readableWells = new Map<string, Well>();
  const canonicalWells = new Map<string, Well>();
  for (const template of wells) {
    const id = wellCoordinate(template);
    if (blocked.has(historyKey(plateId, id))) continue;
    const received = histories.get(historyKey(plateId, id));
    const well = received ? (received.well ?? undefined) : template;
    const visible = well && projectWellFields(scope, well, ownership);
    if (visible && well) {
      canonicalWells.set(id, well);
      readableWells.set(id, visible);
    }
  }
  const rawStacks = projectPlateHistories(
    plateId,
    examples,
    histories,
  );
  const rawResults = new Map<string, WellResult>();
  for (const [id, results] of rawStacks) {
    if (readableWells.has(id))
      for (const result of results) rawResults.set(result.id, result);
  }
  const canReference = (id: string) => {
    const target = rawResults.get(id);
    return (
      !!target &&
      readableWells.has(target.wellId) &&
      canReadResult(scope, target, ownership, canonicalWells.get(target.wellId))
        .ok
    );
  };
  const stacks = new Map<string, readonly WellResult[]>();
  for (const [id, results] of rawStacks) {
    if (!readableWells.has(id)) continue;
    stacks.set(
      id,
      results.flatMap((result) => {
        const projected = projectResultFields(
          scope,
          result,
          ownership,
          canonicalWells.get(id),
        );
        return projected
          ? [projectResultRelations(projected, canReference)]
          : [];
      }),
    );
  }
  const historyFor = (id: string): PlateHistory | undefined => {
    if (blocked.has(historyKey(plateId, id))) return undefined;
    const received = histories.get(historyKey(plateId, id));
    if (!received) return undefined;
    if (received.well && !canReadWell(scope, received.well, ownership).ok)
      return undefined;
    return {
      ...received,
      well: readableWells.get(id) ?? null,
      results: stacks.get(id) ?? [],
    };
  };
  return { wells: [...readableWells.values()], stacks, historyFor };
}

// One stable projection per partition/input revision, shared by graphic and companion receivers.
type ProjectionArguments = Parameters<typeof buildScopedPlate>;
const projections = new WeakMap<
  ScopeCache,
  {
    args: ProjectionArguments;
    revision: number;
    value: ReturnType<typeof buildScopedPlate>;
  }
>();
export function projectScopedPlate(...args: ProjectionArguments) {
  const partition = args[4];
  const revision = partition.getSnapshot();
  const previous = projections.get(partition);
  if (
    previous?.revision === revision &&
    args.every((arg, index) => arg === previous.args[index])
  )
    return previous.value;
  const value = buildScopedPlate(...args);
  projections.set(partition, { args, revision, value });
  return value;
}
