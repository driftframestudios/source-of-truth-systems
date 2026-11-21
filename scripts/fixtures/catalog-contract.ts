import type { CartographyStore, CardCrossRefs } from "../../src/app/types";
import { assertPlateCatalog } from "../../shared/plate-records.mjs";

type Collection = {
  [K in keyof CartographyStore]: CartographyStore[K] extends readonly {
    id: string;
  }[]
    ? K
    : never;
}[keyof CartographyStore];

// Exhaustive at the typed catalog boundary; identities remain collection-local.
const COLLECTIONS = {
  sources: true,
  instructions: true,
  artifacts: true,
  relationships: true,
  comparisons: true,
  decisions: true,
  landmarks: true,
  graphNodes: true,
  graphEdges: true,
  lanes: true,
  laneCards: true,
  laneArrows: true,
  laneFlags: true,
  laneSurfaceLabels: true,
  streams: true,
  connections: true,
  wellResults: true,
  lifecycleRules: true,
  specimens: true,
  qcMetrics: true,
  qcGates: true,
  biomarkers: true,
} satisfies Record<Collection, true>;

const CROSS_REFS = {
  sourceIds: "sources",
  instructionIds: "instructions",
  artifactIds: "artifacts",
  comparisonIds: "comparisons",
  decisionIds: "decisions",
} satisfies Record<keyof CardCrossRefs, Collection>;

function fail(owner: string, detail: string): never {
  throw new Error(`Fixture catalog: ${owner}: ${detail}`);
}

/** Static, typed fixture admission. Transport parsing stays with its runtime owner. */
export function assertFixtureCatalog(
  store: CartographyStore,
  snapshot: { plateId: string; asOf: string },
): void {
  const indexes = new Map<Collection, Set<string>>();
  for (const collection of Object.keys(COLLECTIONS) as Collection[]) {
    const ids = new Set<string>();
    for (const record of store[collection]) {
      if (!record.id.trim())
        fail(`${collection}.id`, "provide a nonempty identity");
      if (ids.has(record.id))
        fail(
          `${collection}[${record.id}].id`,
          "choose a unique identity within this collection",
        );
      ids.add(record.id);
    }
    indexes.set(collection, ids);
  }
  const reference = (owner: string, id: string, ...targets: Collection[]) => {
    if (!targets.some((target) => indexes.get(target)!.has(id))) {
      fail(
        owner,
        `link ${JSON.stringify(id)} to an existing ${targets.join(" or ")} record`,
      );
    }
  };
  const list = (
    owner: string,
    ids: readonly string[],
    ...targets: Collection[]
  ) => {
    ids.forEach((id, index) => reference(`${owner}[${index}]`, id, ...targets));
  };
  const optional = (
    owner: string,
    id: string | null | undefined,
    target: Collection,
  ) => {
    if (id != null) reference(owner, id, target);
  };
  for (const record of store.instructions)
    reference(
      `instructions[${record.id}].sourceId`,
      record.sourceId,
      "sources",
    );
  for (const record of store.decisions)
    list(`decisions[${record.id}].sourceIds`, record.sourceIds, "sources");
  for (const record of store.landmarks)
    reference(`landmarks[${record.id}].sourceId`, record.sourceId, "sources");
  for (const record of store.artifacts)
    list(
      `artifacts[${record.id}].derivedFrom`,
      record.derivedFrom,
      "sources",
      "artifacts",
    );
  for (const record of store.relationships) {
    reference(
      `relationships[${record.id}].fromId`,
      record.fromId,
      "sources",
      "artifacts",
    );
    reference(
      `relationships[${record.id}].toId`,
      record.toId,
      "sources",
      "artifacts",
    );
  }
  for (const record of store.comparisons) {
    for (const key of ["itemA", "itemB"] as const)
      reference(
        `comparisons[${record.id}].${key}.entityId`,
        record[key].entityId,
        "sources",
        "artifacts",
        "instructions",
      );
  }
  list(
    "generationPacket.activeSources",
    store.generationPacket.activeSources,
    "sources",
  );
  list(
    "generationPacket.activeInstructions",
    store.generationPacket.activeInstructions,
    "instructions",
  );
  for (const record of store.graphEdges) {
    reference(`graphEdges[${record.id}].from`, record.from, "graphNodes");
    reference(`graphEdges[${record.id}].to`, record.to, "graphNodes");
  }
  for (const collection of [
    "laneCards",
    "laneFlags",
    "laneSurfaceLabels",
    "connections",
  ] as const) {
    for (const record of store[collection])
      optional(`${collection}[${record.id}].laneId`, record.laneId, "lanes");
  }
  for (const record of store.laneCards) {
    optional(
      `laneCards[${record.id}].artifactRef`,
      record.artifactRef,
      "artifacts",
    );
    optional(`laneCards[${record.id}].streamRef`, record.streamRef, "streams");
    for (const key of Object.keys(CROSS_REFS) as (keyof CardCrossRefs)[]) {
      list(
        `laneCards[${record.id}].crossRefs.${key}`,
        record.crossRefs?.[key] ?? [],
        CROSS_REFS[key],
      );
    }
  }
  for (const record of store.laneArrows) {
    reference(
      `laneArrows[${record.id}].fromCardId`,
      record.fromCardId,
      "laneCards",
    );
    reference(
      `laneArrows[${record.id}].toCardId`,
      record.toCardId,
      "laneCards",
    );
  }
  for (const record of store.streams) {
    reference(
      `streams[${record.id}].producedByLane`,
      record.producedByLane,
      "lanes",
    );
    optional(
      `streams[${record.id}].consumedByLane`,
      record.consumedByLane,
      "lanes",
    );
  }
  for (const record of store.qcGates)
    list(`qcGates[${record.id}].metricIds`, record.metricIds, "qcMetrics");
  for (const record of store.biomarkers)
    reference(
      `biomarkers[${record.id}].specimenId`,
      record.specimenId,
      "specimens",
    );

  const wells = store.plate.map((well) => ({
    ...well,
    id: `${"ABCDEFGH"[well.row]}${well.col + 1}`,
  }));
  const wellIds = new Set(wells.map((well) => well.id));
  for (const well of wells)
    optional(`plate[${well.id}].laneCardId`, well.laneCardId, "laneCards");
  for (const record of store.specimens) {
    if (record.plateWell != null && !wellIds.has(record.plateWell))
      fail(
        `specimens[${record.id}].plateWell`,
        `choose an existing anchor well for ${JSON.stringify(record.plateWell)}`,
      );
  }
  for (const record of store.wellResults) {
    optional(
      `wellResults[${record.id}].specimenId`,
      record.specimenId,
      "specimens",
    );
    for (const [index, artifact] of record.artifacts.entries())
      reference(
        `wellResults[${record.id}].artifacts[${index}].ruleId`,
        artifact.ruleId,
        "lifecycleRules",
      );
  }
  // Reuse bounded result/sequence/file admission, including supersession and reuse.
  try {
    assertPlateCatalog({ ...snapshot, wells, results: store.wellResults });
  } catch (error) {
    fail(
      "plate / wellResults",
      error instanceof Error
        ? error.message
        : "review the Plate record contract",
    );
  }
  assertArtifactLineage(store);
}

function assertArtifactLineage(store: CartographyStore): void {
  const artifacts = new Map(
    store.artifacts.map((record) => [record.id, record]),
  );
  const sources = new Set(store.sources.map((record) => record.id));
  const finished = new Set<string>();
  const active = new Set<string>();
  // Source identities take precedence, as in artifactWorkflows' reference map.
  // Iterator frames avoid both recursive stack growth and a copied edge graph.
  for (const record of store.artifacts) {
    if (finished.has(record.id)) continue;
    const stack = [{ id: record.id, parents: record.derivedFrom.values() }];
    active.add(record.id);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const next = frame.parents.next();
      if (next.done) {
        active.delete(frame.id);
        finished.add(frame.id);
        stack.pop();
        continue;
      }
      if (next.value === frame.id)
        fail(`artifacts[${frame.id}].derivedFrom`, "choose a distinct parent");
      if (sources.has(next.value) || finished.has(next.value)) continue;
      if (active.has(next.value))
        fail(
          `artifacts[${frame.id}].derivedFrom`,
          `remove the lineage cycle through ${JSON.stringify(next.value)}`,
        );
      const parent = artifacts.get(next.value)!;
      active.add(parent.id);
      stack.push({ id: parent.id, parents: parent.derivedFrom.values() });
    }
  }
}
