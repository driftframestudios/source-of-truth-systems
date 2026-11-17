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
const { createQcReviews, createQcReviewCommands } = await import(
  await moduleUrl("../src/app/services/qcReviews.ts", {
    "./command": commandModule,
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

const gates = Object.freeze([
  Object.freeze({
    id: "run",
    stage: "sequencing",
    status: "fail",
    blocking: true,
  }),
  Object.freeze({
    id: "extract",
    stage: "wet_lab",
    status: "pass",
    blocking: true,
  }),
]);

test("QC records an exact gate response and recovery while measured failures remain held", () => {
  const state = owner(createQcReviews(gates));
  const commands = createQcReviewCommands({ ...state, gates });
  assert.equal(
    commands.execute({ id: "run", event: "request_rerun" }).ok,
    true,
  );
  assert.equal(state.getState().byId.run, "rerun_requested");
  assert.equal(state.getState().byId.extract, "unreviewed");
  assert.equal(
    commands.execute({ id: "run", event: "request_rerun" }).kind,
    "transition",
  );
  assert.equal(commands.execute({ id: "run", event: "reopen" }).ok, true);
  assert.equal(commands.execute({ id: "run", event: "retain_hold" }).ok, true);
  assert.equal(state.getState().byId.run, "hold_recorded");
  assert.equal(
    commands.execute({ id: "extract", event: "acknowledge" }).ok,
    true,
  );
  assert.equal(state.getState().byId.extract, "acknowledged");
  assert.equal(gates[0].status, "fail");
  assert.equal(gates[0].blocking, true);
  assert.equal(state.commits(), 4);
});

test("QC refuses stale authority, unsupported dispositions and unknown gates without changing accepted reviews", () => {
  const state = owner(createQcReviews(gates));
  const commands = createQcReviewCommands({ ...state, gates });
  const command = { id: "run", event: "request_rerun" };
  assert.equal(commands.check(command).ok, true);
  state.policy({ role: "viewer" });
  assert.equal(commands.execute(command).kind, "role");
  state.policy({ role: "arc_lead", environment: "val" });
  assert.equal(commands.execute(command).kind, "environment");
  state.policy({ environment: "res" });
  assert.equal(
    commands.execute({ id: "run", event: "acknowledge" }).kind,
    "transition",
  );
  for (const invalid of [
    null,
    { ...command, id: "constructor" },
    { ...command, event: "toString" },
  ])
    assert.equal(commands.execute(invalid).ok, false);
  assert.equal(state.commits(), 0);
});
