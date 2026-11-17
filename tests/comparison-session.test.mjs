import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/services/comparisonSession.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const {
  createComparisonSession,
  applyComparisonDecision,
  selectComparisons,
  summarizeComparisons,
  comparisonEvents,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const records = Object.freeze([
  Object.freeze({
    id: "pending-record",
    resolutionStatus: "pending",
    resolution: "Use the specimen state.",
  }),
  Object.freeze({
    id: "conflict-record",
    resolutionStatus: "conflict",
    resolution: "Keep the regional boundary.",
  }),
]);
const act = (state, event, id = "pending-record", ok = true) =>
  applyComparisonDecision(state, { event, id }, { ok });

test("accepting one resolution updates only that record and its summary; deferral and reopening retain the evidence", () => {
  const initial = createComparisonSession(records);
  const resolved = act(initial, "resolve");
  assert.deepEqual(summarizeComparisons(selectComparisons(resolved)), {
    resolved: 1,
    pending: 0,
    deferred: 0,
    conflict: 1,
  });
  assert.equal(
    resolved.byId["conflict-record"],
    initial.byId["conflict-record"],
  );
  assert.equal(
    resolved.byId["pending-record"].resolution,
    records[0].resolution,
  );
  assert.equal(initial.byId["pending-record"].resolutionStatus, "pending");
  assert.equal(records[0].resolutionStatus, "pending");
  const reopened = act(resolved, "reopen");
  const deferred = act(reopened, "defer");
  assert.deepEqual(summarizeComparisons(selectComparisons(deferred)), {
    resolved: 0,
    pending: 0,
    deferred: 1,
    conflict: 1,
  });
  assert.equal(
    act(deferred, "resolve").byId["pending-record"].resolutionStatus,
    "resolved",
  );
  assert.equal(
    act(deferred, "reopen").byId["pending-record"].resolutionStatus,
    "pending",
  );
  assert.equal(
    act(initial, "defer", "conflict-record").byId["conflict-record"]
      .resolutionStatus,
    "deferred",
  );
});

test("permission refusal, repeated decisions, illegal transitions and unknown IDs preserve the accepted object", () => {
  const initial = createComparisonSession(records);
  assert.equal(act(initial, "resolve", "pending-record", false), initial);
  assert.equal(act(initial, "reopen"), initial);
  for (const id of ["unknown", "__proto__", "constructor", "toString"]) {
    assert.equal(act(initial, "resolve", id), initial);
  }
  assert.equal(act(initial, "constructor"), initial);
  const resolved = act(initial, "resolve");
  assert.equal(act(resolved, "resolve"), resolved);
  assert.equal(act(resolved, "defer"), resolved);
  assert.equal(act(resolved, "reopen", "pending-record", false), resolved);
  assert.deepEqual(comparisonEvents("resolved"), ["reopen"]);
  assert.deepEqual(comparisonEvents("deferred"), ["resolve", "reopen"]);
});
