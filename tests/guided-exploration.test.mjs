import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/app/components/guide/guideState.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const {
  GUIDE_PREFERENCE_KEY,
  createGuideState,
  guideReducer,
  readGuideSeen,
  markGuideSeen,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const acknowledge = (state, readiness = "ready") =>
  guideReducer(state, {
    type: "acknowledge",
    requestId: state.requestId,
    readiness,
  });
const advance = (state, requestId = state.requestId) =>
  guideReducer(state, { type: "next", automatic: true, requestId });

test("invitation leaves scene ownership alone and playback starts only through an explicit choice", () => {
  const closed = Object.freeze(createGuideState());
  assert.deepEqual(closed, { phase: "closed", requestId: 0 });
  assert.equal(guideReducer(closed, { type: "play" }), closed);
  const invitation = Object.freeze(guideReducer(closed, { type: "invite" }));
  assert.deepEqual(invitation, { phase: "invitation", requestId: 0 });
  assert.equal(guideReducer(invitation, { type: "next" }), invitation);
  assert.deepEqual(guideReducer(invitation, { type: "start" }), {
    phase: "touring",
    step: "workflow",
    playing: false,
    readiness: "pending",
    requestId: 1,
  });
  const selected = guideReducer(invitation, {
    type: "start",
    step: "history",
    playing: true,
  });
  assert.equal(selected.step, "history");
  assert.equal(selected.playing, true);
  assert.equal(selected.readiness, "pending");
});

test("automatic progress waits for the current scene and rejects stale readiness or timers", () => {
  const first = Object.freeze(
    guideReducer(createGuideState(), { type: "start", playing: true }),
  );
  assert.equal(advance(first), first);
  assert.equal(
    guideReducer(first, {
      type: "acknowledge",
      requestId: 0,
      readiness: "ready",
    }),
    first,
  );
  const ready = acknowledge(first);
  assert.equal(first.readiness, "pending");
  const second = advance(ready);
  assert.equal(second.step, "history");
  assert.equal(second.readiness, "pending");
  assert.ok(second.requestId > first.requestId);
  assert.equal(advance(acknowledge(second), first.requestId).step, "history");
});

test("rapid navigation and an explicit scene retry own fresh requests", () => {
  let current = guideReducer(createGuideState(), { type: "start" });
  assert.equal(guideReducer(current, { type: "back" }), current);
  const retry = guideReducer(current, { type: "select", step: "workflow" });
  assert.ok(retry.requestId > current.requestId);
  assert.equal(retry.step, "workflow");
  const first = current;
  current = guideReducer(current, { type: "next" });
  assert.equal(current.step, "history");
  const second = current;
  current = guideReducer(current, { type: "select", step: "resources" });
  const third = current;
  current = guideReducer(current, { type: "back" });
  assert.equal(current.step, "history");
  assert.equal(current.playing, false);
  assert.equal(current.readiness, "pending");
  assert.ok(current.requestId > third.requestId);
  for (const prior of [first, second, third]) {
    assert.equal(
      guideReducer(current, {
        type: "acknowledge",
        requestId: prior.requestId,
        readiness: "ready",
      }),
      current,
    );
  }
});

test("pausing preserves the scene request and late readiness cannot restart playback", () => {
  const started = guideReducer(createGuideState(), {
    type: "start",
    playing: true,
  });
  const paused = guideReducer(started, { type: "pause" });
  assert.equal(paused.requestId, started.requestId);
  assert.equal(paused.step, started.step);
  const ready = acknowledge(paused);
  assert.equal(ready.playing, false);
  assert.equal(advance(ready), ready);
  const resumed = guideReducer(ready, { type: "play" });
  assert.equal(resumed.requestId, started.requestId);
  assert.equal(advance(resumed).step, "history");
  const unavailable = acknowledge(resumed, "unavailable");
  assert.equal(unavailable.playing, false);
  assert.equal(guideReducer(unavailable, { type: "play" }), unavailable);
  assert.equal(advance(unavailable), unavailable);
  assert.equal(guideReducer(unavailable, { type: "next" }).step, "history");
  assert.equal(acknowledge(unavailable).playing, false);
});

test("completion leaves the final scene under visitor control and close/replay rejects earlier acknowledgements", () => {
  let current = guideReducer(createGuideState(), {
    type: "start",
    playing: true,
  });
  current = advance(acknowledge(current));
  current = advance(acknowledge(current));
  assert.equal(current.step, "resources");
  const finalReady = acknowledge(current);
  const completed = advance(finalReady);
  assert.equal(completed.step, "resources");
  assert.equal(completed.playing, false);
  assert.equal(completed.readiness, "ready");
  assert.equal(completed.requestId, finalReady.requestId);
  assert.equal(guideReducer(completed, { type: "next" }), completed);
  const closed = guideReducer(completed, { type: "close" });
  assert.equal(acknowledge(closed), closed);
  assert.equal(advance(closed), closed);
  const replay = guideReducer(closed, { type: "start", playing: true });
  assert.equal(replay.step, "workflow");
  assert.equal(replay.readiness, "pending");
  assert.ok(replay.requestId > completed.requestId);
  assert.equal(
    guideReducer(replay, {
      type: "acknowledge",
      requestId: completed.requestId,
      readiness: "ready",
    }),
    replay,
  );
});

test("the preference admits only its exact marker and remains safe without browser storage", () => {
  assert.equal(GUIDE_PREFERENCE_KEY, "sot:guide:v1");
  for (const value of [null, "", "true", "seen ", "SEEN", '{"seen":true}']) {
    assert.equal(
      readGuideSeen({
        getItem(key) {
          assert.equal(key, "sot:guide:v1");
          return value;
        },
      }),
      false,
    );
  }
  assert.equal(readGuideSeen({ getItem: () => "seen" }), true);
  assert.equal(readGuideSeen(), false);
  assert.equal(readGuideSeen(null), false);
  assert.equal(
    readGuideSeen({
      getItem() {
        throw new Error("Storage denied");
      },
    }),
    false,
  );
  const writes = [];
  markGuideSeen({ setItem: (...entry) => writes.push(entry) });
  assert.deepEqual(writes, [["sot:guide:v1", "seen"]]);
  assert.doesNotThrow(() => markGuideSeen());
  assert.doesNotThrow(() =>
    markGuideSeen({
      setItem() {
        throw new Error("Storage denied");
      },
    }),
  );
});
