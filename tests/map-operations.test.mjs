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
    outputText = outputText
      .replaceAll(`'${specifier}'`, `'${url}'`)
      .replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const commandModule = await moduleUrl("../src/app/services/command.ts");
const transitions = await moduleUrl("../src/app/services/recordSession.ts");
const { createMapSession, createMapCommands, mapActions } = await import(
  await moduleUrl("../src/app/services/mapOperations.ts", {
    "./command": commandModule,
    "./recordSession": transitions,
  })
);
const types = await moduleUrl("../src/app/types/access.ts");
const access = await moduleUrl("../src/app/services/accessService.ts", {
  "../types/access": types,
});
const scope = await moduleUrl("../src/app/services/permissionScope.ts", {
  "./accessService": access,
});
const kernel = new URL("../shared/permission-scope.mjs", import.meta.url).href;
const { decidePermission } = await import(
  await moduleUrl("../src/app/services/permissionPolicy.ts", {
    "./permissionScope": scope,
    "../../../shared/permission-scope.mjs": kernel,
  })
);

function owner(initial) {
  let state = initial;
  let policy = {
    principalId: "prin_self",
    role: "arc_lead",
    environment: "res",
  };
  let commits = 0;
  return {
    getState: () => state,
    commit: (next) => {
      state = next;
      commits++;
    },
    checkPermission: (request) => decidePermission({ ...policy, ...request }),
    policy: (patch) => {
      policy = { ...policy, ...patch };
    },
    commits: () => commits,
  };
}

test("Map reuses legal order and review branches, preserves other nodes, and keeps terminal orders terminal", () => {
  const initial = createMapSession([
    {
      id: "pipeline",
      orderState: "in_progress",
      labState: "dry_lab",
      dataClass: "synthetic",
    },
    { id: "review", reviewState: "in_review", dataClass: "limited" },
    { id: "finished", orderState: "fulfilled", dataClass: "synthetic" },
  ]);
  const state = owner(initial);
  const commands = createMapCommands(state);
  assert.equal(
    commands.execute({ id: "pipeline", type: "order", event: "hold" }).ok,
    true,
  );
  assert.equal(state.getState().byId.pipeline.orderState, "on_hold");
  assert.equal(state.getState().byId.review, initial.byId.review);
  assert.deepEqual(
    mapActions(state.getState().byId.pipeline).map(
      (step) => step.command.event,
    ),
    ["release", "cancel"],
  );
  assert.equal(
    commands.execute({ id: "pipeline", type: "order", event: "fulfill" }).kind,
    "transition",
  );
  assert.equal(
    commands.execute({ id: "pipeline", type: "order", event: "release" }).ok,
    true,
  );
  assert.equal(
    commands.execute({ id: "review", type: "review", event: "request_changes" })
      .ok,
    true,
  );
  assert.equal(state.getState().byId.review.reviewState, "changes_requested");
  assert.equal(
    commands.execute({ id: "review", type: "review", event: "sign_off" }).kind,
    "transition",
  );
  assert.equal(
    commands.execute({ id: "review", type: "review", event: "resubmit" }).ok,
    true,
  );
  assert.equal(
    commands.execute({ id: "finished", type: "order", event: "cancel" }).kind,
    "transition",
  );
  assert.equal(initial.byId.pipeline.orderState, "in_progress");
  assert.equal(state.getState().byId.pipeline.labState, "dry_lab");
});

test("Map acceptance rechecks capability, environment and canonical classification after its preview", () => {
  const state = owner(
    createMapSession([
      { id: "pipeline", orderState: "in_progress", dataClass: "synthetic" },
      { id: "clinical", reviewState: "in_review", dataClass: "phi" },
    ]),
  );
  const commands = createMapCommands(state);
  const hold = { id: "pipeline", type: "order", event: "hold" };
  assert.equal(commands.check(hold).ok, true);
  const captured = commands.execute;
  state.policy({ role: "viewer" });
  assert.equal(captured(hold).kind, "role");
  state.policy({ role: "arc_lead", environment: "val" });
  assert.equal(captured(hold).kind, "environment");
  state.policy({ environment: "res" });
  assert.equal(
    commands.execute({
      id: "clinical",
      type: "review",
      event: "approve",
      dataClass: "synthetic",
    }).kind,
    "clearance",
  );
  for (const command of [
    null,
    { ...hold, id: "toString" },
    { ...hold, type: "constructor" },
    { ...hold, event: "toString" },
  ])
    assert.equal(commands.execute(command).ok, false);
  assert.equal(state.commits(), 0);
});
