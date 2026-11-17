import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/services/navigation/navigationUrl.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const {
  parseNavigation,
  serializeNavigation,
  navigationHistoryMode,
  DEFAULT_NAVIGATION,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("declared sections and plate preferences round trip through public vocabulary", () => {
  const expected = {
    section: "instructions",
    scene: "plate",
    plate: "history",
    lens: "storage",
  };
  assert.deepEqual(
    parseNavigation(
      "?section=requirements&scene=plate&plate=history&lens=storage",
    ),
    expected,
  );
  assert.equal(
    serializeNavigation(expected),
    "?section=requirements&scene=plate&plate=history&lens=storage",
  );
  assert.equal(parseNavigation("?section=release-plan").section, "next-arc");
  for (const section of [
    "map",
    "lanes",
    "specimens",
    "cohort",
    "qc",
    "biomarkers",
    "sources",
    "artifacts",
    "comparisons",
    "decisions",
    "presentations",
    "profile",
  ]) {
    assert.equal(parseNavigation(`?section=${section}`).section, section);
  }
  assert.deepEqual(parseNavigation(""), DEFAULT_NAVIGATION);
  assert.equal(serializeNavigation(DEFAULT_NAVIGATION), "");
});

test("ambiguous or malformed known inputs are refused; unrelated query data gains no authority", () => {
  for (const input of [
    "?scene=plate&scene=corridor",
    "?lens=status&lens=status",
    "?section=__proto__",
    "?scene=",
    "?plate=locked",
    "?lens=%FF",
    `?section=${"a".repeat(33)}`,
    `?ignored=${"a".repeat(1024)}`,
  ]) {
    assert.equal(parseNavigation(input), null, input.slice(0, 70));
  }
  const parsed = parseNavigation(
    "?section=sources&role=admin&workspace=foreign&draft=private&return=https://example.test&unknown=x&unknown=y",
  );
  assert.deepEqual(parsed, { ...DEFAULT_NAVIGATION, section: "sources" });
  assert.equal(
    serializeNavigation({ ...parsed, actor: "admin", draft: "private" }),
    "?section=sources",
  );
  assert.equal(
    serializeNavigation({ ...DEFAULT_NAVIGATION, scene: "unrecognized" }),
    "",
  );
});

test("section and scene navigation add a return point; plate adjustments replace the current point", () => {
  assert.equal(
    navigationHistoryMode(DEFAULT_NAVIGATION, {
      ...DEFAULT_NAVIGATION,
      section: "sources",
    }),
    "pushState",
  );
  assert.equal(
    navigationHistoryMode(DEFAULT_NAVIGATION, {
      ...DEFAULT_NAVIGATION,
      scene: "plate",
    }),
    "pushState",
  );
  assert.equal(
    navigationHistoryMode(DEFAULT_NAVIGATION, {
      ...DEFAULT_NAVIGATION,
      plate: "history",
      lens: "kind",
    }),
    "replaceState",
  );
});
