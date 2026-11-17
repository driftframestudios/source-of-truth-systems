import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });
  for (const [specifier, url] of Object.entries(imports))
    outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const { meetsSpecimenTarget, meetsAllSpecimenTargets, specimenTargetLabel } =
  await import(await moduleUrl("../src/app/services/specimenQuality.ts"));
const results = await moduleUrl("../src/app/data/wellResults.ts");
const { STORE } = await import(
  await moduleUrl("../src/app/data/index.ts", { "./wellResults": results })
);

test("explicit target direction determines the result, including equality at either boundary", () => {
  for (const [comparator, value, expected] of [
    ["gte", 79, false],
    ["gte", 80, true],
    ["gte", 94, true],
    ["lte", 22, true],
    ["lte", 30, true],
    ["lte", 31, false],
  ]) {
    const metric = {
      comparator,
      value,
      target: comparator === "gte" ? 80 : 30,
    };
    assert.equal(meetsSpecimenTarget(metric), expected);
  }
  assert.equal(
    specimenTargetLabel({ comparator: "gte", target: 80, unit: "×" }),
    "Target at least 80×",
  );
  assert.equal(
    specimenTargetLabel({ comparator: "lte", target: 30, unit: "%" }),
    "Target at most 30%",
  );
});

test("specimen quality and cohort matching use the same declared targets while flags retain their own meaning", () => {
  const specimen = STORE.specimens.find(
    (record) => record.id === "SPX-2026-0483",
  );
  const duplication = specimen.coverage.find(
    (metric) => metric.label === "Dup rate",
  );
  assert.deepEqual(duplication, {
    label: "Dup rate",
    value: 22,
    target: 30,
    comparator: "lte",
    unit: "%",
  });
  assert.equal(meetsSpecimenTarget(duplication), true);
  assert.equal(meetsSpecimenTarget(specimen.coverage[0]), false);
  assert.equal(meetsAllSpecimenTargets(specimen.coverage), false);
  assert.equal(meetsAllSpecimenTargets(specimen.coverage.slice(1)), true);
  assert.equal(meetsAllSpecimenTargets([]), false);
  assert.deepEqual(specimen.qcFlags, ["off_target_elevated"]);
  assert.deepEqual(
    STORE.specimens
      .filter((record) => meetsAllSpecimenTargets(record.coverage))
      .map((record) => record.id),
    [
      "SPX-2026-0481",
      "SPX-2026-0485",
      "SPX-2026-0486",
      "SPX-2026-0489",
      "SPX-2026-0493",
      "SPX-2026-0495",
      "SPX-2026-0497",
    ],
  );
});
