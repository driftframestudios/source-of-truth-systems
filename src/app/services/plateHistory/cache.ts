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

export interface ScopeCache {
  histories: Map<string, PlateHistory>;
  blocked: Map<string, "denied" | "unavailable">;
}
export type HistoryCacheStore = Map<string, ScopeCache>;
export function cacheFor(
  cache: HistoryCacheStore,
  scopeKey: string,
): ScopeCache {
  let partition = cache.get(scopeKey);
  if (!partition) {
    partition = { histories: new Map(), blocked: new Map() };
    cache.set(scopeKey, partition);
  }
  return partition;
}
export const wellCoordinate = (well: Pick<Well, "row" | "col">) =>
  `${"ABCDEFGH"[well.row]}${well.col + 1}`;

/** A received well replaces the bundled metadata, including an explicitly missing well. */
export function canonicalWell(
  plateId: string,
  id: string,
  wells: readonly Well[],
  partition: ScopeCache,
): Well | undefined {
  const history = partition.histories.get(historyKey(plateId, id));
  return history
    ? (history.well ?? undefined)
    : wells.find((well) => wellCoordinate(well) === id);
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
  if (capturedScopeKey !== currentScopeKey) return undefined;
  if ("error" in result) return "unavailable" as const;
  if (result.value.kind !== "ready") {
    partition.blocked.set(key, result.value.kind);
    partition.histories.delete(key);
    return result.value.kind;
  }
  partition.blocked.delete(key);
  partition.histories.set(key, result.value.history);
  return "ready" as const;
}

/** One current-scope projection supplies geometry, metadata, counts and relationship targets. */
export function projectScopedPlate(
  scope: PermissionScope,
  plateId: string,
  wells: readonly Well[],
  examples: ResultStacks,
  partition: ScopeCache,
  ownership: RecordOwnership,
) {
  const readableWells = new Map<string, Well>();
  const canonicalWells = new Map<string, Well>();
  for (const template of wells) {
    const id = wellCoordinate(template);
    if (partition.blocked.has(historyKey(plateId, id))) continue;
    const well = canonicalWell(plateId, id, wells, partition);
    const visible = well && projectWellFields(scope, well, ownership);
    if (visible && well) {
      canonicalWells.set(id, well);
      readableWells.set(id, visible);
    }
  }
  const rawStacks = projectPlateHistories(
    plateId,
    examples,
    partition.histories,
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
    if (partition.blocked.has(historyKey(plateId, id))) return undefined;
    const received = partition.histories.get(historyKey(plateId, id));
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
