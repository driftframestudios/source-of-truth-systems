import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(
  new URL("../src/app/components/mobile/corridorView.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const { selectCorridorView, INITIAL_CORRIDOR_VIEW, toggleSet } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const lanes = [
  { id: "wet-a", stage: "wet_lab" },
  { id: "wet-b", stage: "wet_lab" },
  { id: "dry", stage: "dry_lab" },
];
const cards = [
  { id: "intake", laneId: "wet-a", kind: "process", label: "Sample intake" },
  {
    id: "hidden-match",
    laneId: "wet-b",
    kind: "process",
    label: "Sample intake",
  },
  { id: "control", laneId: "wet-a", kind: "control", label: "Sample control" },
  { id: "dry-result", laneId: "dry", kind: "process", label: "Variant review" },
];

test("overview combines stage, hidden lanes, kinds and search before projecting cards", () => {
  const view = {
    ...INITIAL_CORRIDOR_VIEW,
    mode: "overview",
    stage: "wet_lab",
    hidden: new Set(["wet-b"]),
    hideKinds: new Set(["control"]),
    query: " SAMPLE ",
  };
  const result = selectCorridorView(lanes, cards, view, "dry");
  assert.deepEqual(
    result.lanes.map((lane) => lane.id),
    ["wet-a"],
  );
  assert.deepEqual(
    result.cards.map((card) => card.id),
    ["intake"],
  );
  assert.deepEqual(
    selectCorridorView(lanes, cards, { ...view, query: "absent" }, "dry").cards,
    [],
  );
});

test("one-lane focus and visibility toggles keep prior view state independently owned", () => {
  const hidden = new Set(["wet-a"]);
  const revealed = toggleSet(hidden, "wet-a");
  assert.equal(hidden.has("wet-a"), true);
  assert.equal(revealed.has("wet-a"), false);
  const result = selectCorridorView(
    lanes,
    cards,
    { ...INITIAL_CORRIDOR_VIEW, stage: "dry_lab", hidden: revealed },
    "wet-a",
  );
  assert.deepEqual(
    result.cards.map((card) => card.id),
    ["intake", "control"],
  );
});
