import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements))
    source = source
      .replaceAll(`"${from}"`, JSON.stringify(to))
      .replaceAll(`'${from}'`, JSON.stringify(to));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const resultsUrl = await moduleUrl("../src/app/data/wellResults.ts");
const { STORE } = await import(
  await moduleUrl("../src/app/data/index.ts", {
    "./wellResults": resultsUrl,
  })
);
const { assertFixtureCatalog } = await import(
  await moduleUrl("../scripts/fixtures/catalog-contract.ts", {
    "../../shared/plate-records.mjs": new URL(
      "../shared/plate-records.mjs",
      import.meta.url,
    ).href,
  })
);
const snapshot = { plateId: "NVSX-2026-118", asOf: "2026-09-28" };
const empty = () =>
  Object.fromEntries(
    Object.keys(STORE).map((key) => [
      key,
      key === "generationPacket"
        ? { activeSources: [], activeInstructions: [] }
        : [],
    ]),
  );

test("the complete deterministic fixture satisfies relationships without mutation", () => {
  const before = structuredClone(STORE);
  assertFixtureCatalog(STORE, snapshot);
  assert.deepEqual(STORE, before);
});

test("collection identities and missing links name the source field to repair", () => {
  const duplicate = empty();
  duplicate.sources = [{ id: "source" }, { id: "source" }];
  assert.throws(
    () => assertFixtureCatalog(duplicate, snapshot),
    /sources\[source\]\.id.*unique/,
  );
  const missing = empty();
  missing.instructions = [{ id: "requirement", sourceId: "absent" }];
  assert.throws(
    () => assertFixtureCatalog(missing, snapshot),
    /instructions\[requirement\]\.sourceId.*absent.*sources/,
  );
  const missingCrossRef = empty();
  missingCrossRef.lanes = [{ id: "lane" }];
  missingCrossRef.laneCards = [
    { id: "card", laneId: "lane", crossRefs: { decisionIds: ["absent"] } },
  ];
  assert.throws(
    () => assertFixtureCatalog(missingCrossRef, snapshot),
    /laneCards\[card\]\.crossRefs.decisionIds\[0\].*decisions/,
  );
});

test("artifact lineage rejects a cycle while workflow cycles, shared identities and optional links remain valid", () => {
  const catalog = empty();
  catalog.sources = [{ id: "source" }];
  catalog.artifacts = [
    { id: "a", derivedFrom: ["b"] },
    { id: "b", derivedFrom: ["a"] },
  ];
  assert.throws(
    () => assertFixtureCatalog(catalog, snapshot),
    /artifacts\[b\]\.derivedFrom.*lineage cycle/,
  );
  catalog.artifacts = [
    { id: "source", derivedFrom: [] },
    { id: "b", derivedFrom: ["source"] },
  ];
  catalog.lanes = [{ id: "lane" }];
  catalog.laneCards = [
    { id: "a", laneId: "lane" },
    { id: "b", laneId: "lane" },
  ];
  catalog.laneArrows = [
    { id: "ab", fromCardId: "a", toCardId: "b" },
    { id: "ba", fromCardId: "b", toCardId: "a" },
  ];
  catalog.connections = [{ id: "unassigned", laneId: null }];
  assertFixtureCatalog(catalog, snapshot);
});

test("Plate ownership extends the existing result and physical-file contract", () => {
  const catalog = structuredClone(STORE);
  catalog.wellResults[0].artifacts[0].ruleId = "absent";
  assert.throws(
    () => assertFixtureCatalog(catalog, snapshot),
    /wellResults\[.*\]\.artifacts\[0\]\.ruleId.*lifecycleRules/,
  );
  catalog.wellResults = structuredClone(STORE.wellResults);
  catalog.wellResults[0].supersedes = catalog.wellResults[0].id;
  assert.throws(
    () => assertFixtureCatalog(catalog, snapshot),
    /plate \/ wellResults.*supersession/,
  );
});
