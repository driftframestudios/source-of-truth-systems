import assert from "node:assert/strict";
import test from "node:test";
import { exampleData } from "../build/server/example-data.mjs";
import { createExampleRepository } from "../server/data/example-repository.mjs";
import {
  CATALOG_LIMITS,
  CATALOG_PROBES,
  catalogId,
} from "../server/data/catalog-contract.mjs";
import {
  decodeWells,
  decodeResults,
  createResultReader,
} from "../server/data/catalog-rows.mjs";

const well = exampleData.wells.find((well) => well.id === "C3");
const original = exampleData.results.find(
  (result) => result.wellId === "C3" && result.artifacts.length,
);
const row = {
  id: original.id,
  well_id: original.wellId,
  sequence_index: original.seq,
  supersedes_id: original.supersedes ?? null,
  anchor_plate_id: exampleData.plateId,
  metadata: {
    ...original,
    id: "stale-id",
    wellId: "A1",
    seq: 49,
    supersedes: "stale-parent",
    artifacts: [],
  },
};
const references = original.artifacts.map((artifact) => ({
  result_id: original.id,
  object_key: artifact.key,
  reused_from_id: artifact.reusedFrom ?? null,
  metadata: { ...artifact, key: "stale-key", legalHold: !artifact.legalHold },
  reference_metadata: {
    legalHold: artifact.legalHold,
    restore: artifact.restore,
  },
}));

test("SQL identity and reference ownership win over conflicting metadata for both wire encodings", () => {
  for (const encode of [(value) => value, JSON.stringify]) {
    assert.deepEqual(
      decodeWells([
        {
          id: well.id,
          plate_id: exampleData.plateId,
          row_index: well.row,
          column_index: well.col,
          as_of: exampleData.asOf,
          metadata: encode({ ...well, id: "wrong", row: 7, col: 11 }),
        },
      ]),
      [
        JSON.parse(
          JSON.stringify({
            ...well,
            plateId: exampleData.plateId,
            asOf: exampleData.asOf,
          }),
        ),
      ],
    );
    assert.deepEqual(
      decodeResults(
        [{ ...row, metadata: encode(row.metadata) }],
        references.map((ref) => ({
          ...ref,
          metadata: encode(ref.metadata),
          reference_metadata: encode(ref.reference_metadata),
        })),
      ),
      [
        JSON.parse(
          JSON.stringify({ ...original, anchorPlateId: exampleData.plateId }),
        ),
      ],
    );
  }
});

test("bounded rows, malformed metadata and opaque IDs retain explicit outcomes", () => {
  for (const value of ["", "a".repeat(161), "\u0000", "\ud800"]) {
    assert.throws(() => catalogId(value), { code: "CATALOG_INVALID" });
    assert.throws(() => createExampleRepository(exampleData).getPlate(value), {
      code: "CATALOG_INVALID",
    });
  }
  assert.equal(CATALOG_PROBES.wells, CATALOG_LIMITS.wells + 1);
  assert.equal(CATALOG_PROBES.history, CATALOG_LIMITS.history + 1);
  assert.equal(
    CATALOG_PROBES.references,
    CATALOG_LIMITS.history * CATALOG_LIMITS.artifacts + 1,
  );
  assert.deepEqual(decodeResults([], []), []);
  assert.throws(
    () => decodeResults(Array(CATALOG_PROBES.history).fill(row), []),
    { code: "CATALOG_INVALID" },
  );
  assert.throws(
    () =>
      decodeResults(
        [row],
        Array(CATALOG_LIMITS.artifacts + 1).fill(references[0]),
      ),
    { code: "CATALOG_INVALID" },
  );
  for (const metadata of ["{", "[]", null])
    assert.throws(() => decodeResults([{ ...row, metadata }], []), {
      code: "CATALOG_INVALID",
    });
  const example = createExampleRepository(exampleData);
  assert.equal(example.getWell("other-plate", "C3"), null);
  assert.equal(example.getResult("missing"), null);
  assert.deepEqual(example.listHistory(exampleData.plateId, "missing"), []);
});

test("one joined read seeds request-local results; concurrent and missing lookups reuse their promise", async () => {
  let joins = 0,
    reads = 0;
  const reader = createResultReader(async (ids) => {
    joins++;
    assert.deepEqual(ids, [original.id]);
    return references;
  });
  const records = await reader.decode([row]);
  assert.equal(
    await reader.get(original.id, async () => {
      throw new Error("Already loaded");
    }),
    records[0],
  );
  assert.equal(joins, 1);
  const missing = () =>
    reader.get("missing", async () => {
      reads++;
      return [];
    });
  assert.deepEqual(await Promise.all([missing(), missing()]), [null, null]);
  assert.equal(reads, 1);
  const separate = createResultReader(async () => []);
  await separate.get("missing", async () => {
    reads++;
    return [];
  });
  assert.equal(reads, 2);
});
