import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createHash } from "node:crypto";
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
const command = await moduleUrl("../src/app/services/command.ts");
const source = await moduleUrl("../src/app/services/sourceSession.ts", {
    "../../../shared/workspace-contract.mjs": new URL("../shared/workspace-contract.mjs", import.meta.url).href,
  "./command": command,
});
const browser = await moduleUrl("../src/app/services/browserSession.ts");
const responseDecoder = await moduleUrl("../src/app/services/workspaceResponse.ts", {
  "../../../shared/workspace-contract.mjs": new URL("../shared/workspace-contract.mjs", import.meta.url).href,
});
const transport = await moduleUrl("../src/app/services/workspaceTransport.ts", { "./workspaceResponse": responseDecoder });
const { WORKSPACE_OPERATIONS } = await import(transport);
const { createSourceWorkspace } = await import(
  await moduleUrl("../src/app/services/sourceWorkspace.ts", {
    "./sourceSession": source,
    "./browserSession": browser,
    "./workspaceTransport": transport,
  })
);
const baseline = [
  {
    id: "source",
    title: "Baseline",
    description: "Source summary.",
    tags: ["baseline"],
    role: "scientific_authority",
    lastUpdated: "2026-01-01",
  },
];
const scenario = {
  version: 1,
  principalId: "prin_self",
  roleId: "arc_lead",
  environment: "res",
  grantChanges: [],
};
const context = {
  scenario,
  checkPermission: () => ({ ok: true }),
  isCurrent: () => true,
};
const workspace = {
  id: "one",
  createdAt: "2026-11-17T00:00:00Z",
  expiresAt: "2026-11-18T00:00:00Z",
  eventCount: 0,
};
const entry = (revision, title = "Stored") => ({
  id: "source",
  revision,
  title,
  description: "Stored summary.",
  tags: ["stored"],
});
const edit = (revision = 0) => ({
  type: "edit",
  id: "source",
  revision,
  metadata: {
    title: "Edited",
    description: "Edited summary.",
    tags: ["edited"],
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("browser operation hashes match each reviewed server document", async () => {
  for (const [name, hash] of Object.entries(WORKSPACE_OPERATIONS))
    assert.equal(
      hash,
      createHash("sha256")
        .update(
          await readFile(
            new URL(
              `../server/workspaces/operations/${name}.graphql`,
              import.meta.url,
            ),
          ),
        )
        .digest("hex"),
    );
});
test("only explicit LOCAL enables local acceptance; storage failure leaves drafts and records unchanged", async () => {
  let code = "UNAVAILABLE";
  const owner = createSourceWorkspace({
    baseline,
    request: async () => ({ code, message: code }),
  });
  const before = owner.state.getSnapshot();
  assert.equal((await owner.execute(edit(), context)).ok, false);
  assert.equal(owner.state.getSnapshot(), before);
  code = "LOCAL";
  await owner.initialize(scenario, true);
  assert.equal((await owner.execute(edit(), context)).ok, true);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, "Edited");
  assert.equal(
    owner.state.getSnapshot().byId.source.record.role,
    "scientific_authority",
  );
});

test("unsupported Source text returns invalid before a hosted write and leaves the draft intact", async () => {
  const calls = [];
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      calls.push(name);
      return { code: "ABSENT", message: "Start a workspace." };
    },
  });
  await owner.initialize(scenario);
  const before = owner.state.getSnapshot();
  const draft = edit();
  draft.metadata.description = "Retain this draft\u0000until corrected";
  const result = await owner.execute(draft, context);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
  assert.equal(owner.state.getSnapshot(), before);
  assert.equal(
    draft.metadata.description,
    "Retain this draft\u0000until corrected",
  );
  assert.ok(!calls.includes("StartWorkspace"));
  assert.ok(!calls.includes("SaveSource"));
});
test("first explicit save starts and hydrates workspace; ambiguous retry keeps its command identity", async () => {
  const calls = [];
  let active = false;
  let attempts = 0;
  let ids = 0;
  const owner = createSourceWorkspace({
    baseline,
    newId: () => `command-${++ids}`,
    request: async (name, variables) => {
      calls.push([name, variables]);
      if (name === "WorkspaceStatus")
        return {
          code: active ? "OK" : "ABSENT",
          message: "status",
          workspace: active ? workspace : null,
        };
      if (name === "StartWorkspace") {
        active = true;
        return { code: "OK", message: "started", workspace };
      }
      if (name === "WorkspaceSnapshot")
        return {
          code: "OK",
          message: "loaded",
          workspace,
          sources: [{ ...baseline[0], revision: 0 }],
        };
      if (name === "SaveSource")
        return ++attempts === 1
          ? { code: "UNAVAILABLE", message: "Retry this draft." }
          : {
              code: "OK",
              message: "accepted",
              workspace: { ...workspace, eventCount: 1 },
              source: entry(1, "Edited"),
              changed: true,
              replayed: true,
            };
      throw new Error(name);
    },
  });
  assert.equal((await owner.execute(edit(), context)).ok, false);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, "Baseline");
  assert.equal((await owner.execute(edit(), context)).ok, true);
  const saves = calls.filter(([name]) => name === "SaveSource");
  assert.equal(
    saves[0][1].input.idempotencyKey,
    saves[1][1].input.idempotencyKey,
  );
  assert.equal(calls.filter(([name]) => name === "StartWorkspace").length, 1);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 1);
});
test("late accepted receipts preserve a newer hydrated revision and scenario changes suppress publication", async () => {
  let snapshot = entry(1);
  let pending = deferred();
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      if (name === "WorkspaceStatus")
        return { code: "OK", message: "status", workspace };
      if (name === "WorkspaceSnapshot")
        return {
          code: "OK",
          message: "loaded",
          workspace,
          sources: [snapshot],
        };
      if (name === "SaveSource") return pending.promise;
      throw new Error(name);
    },
  });
  await owner.initialize(scenario);
  const saving = owner.execute(edit(1), context);
  await new Promise((resolve) => setImmediate(resolve));
  snapshot = entry(3, "Newer tab");
  await owner.initialize(scenario, true);
  pending.resolve({
    code: "OK",
    message: "accepted",
    workspace,
    source: entry(2, "Older receipt"),
    changed: true,
  });
  assert.equal((await saving).ok, true);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, "Newer tab");
  pending = deferred();
  let current = true;
  const next = owner.execute(edit(3), { ...context, isCurrent: () => current });
  await new Promise((resolve) => setImmediate(resolve));
  current = false;
  pending.resolve({
    code: "OK",
    message: "accepted",
    workspace,
    source: entry(4, "Other scenario"),
    changed: true,
  });
  assert.equal((await next).ok, false);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 3);
});
test("reset prevents an older hydration from reintroducing workspace records", async () => {
  const loaded = deferred();
  let snapshotCalls = 0;
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      if (name === "WorkspaceStatus")
        return { code: "OK", message: "status", workspace };
      if (name === "WorkspaceSnapshot") {
        snapshotCalls++;
        return loaded.promise;
      }
      if (name === "ResetWorkspace")
        return { code: "ABSENT", message: "reset" };
      throw new Error(name);
    },
  });
  const loading = owner.initialize(scenario);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(snapshotCalls, 1);
  assert.equal((await owner.reset(scenario)).ok, true);
  loaded.resolve({
    code: "OK",
    message: "loaded",
    workspace,
    sources: [entry(5)],
  });
  await loading;
  assert.equal(owner.status.getSnapshot().phase, "absent");
  assert.equal(owner.state.getSnapshot().byId.source.revision, 0);
});
test("conflicts refresh accepted metadata while expiry requires an explicit new workspace", async () => {
  let snapshot = entry(1);
  let code = "CONFLICT";
  let starts = 0;
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      if (name === "WorkspaceStatus")
        return { code: "OK", message: "status", workspace };
      if (name === "WorkspaceSnapshot")
        return {
          code: "OK",
          message: "loaded",
          workspace,
          sources: [snapshot],
        };
      if (name === "SaveSource") {
        snapshot = entry(2, "Concurrent edit");
        return { code, message: "Keep your draft." };
      }
      if (name === "StartWorkspace") {
        starts++;
        return { code: "OK", message: "started", workspace };
      }
      throw new Error(name);
    },
  });
  await owner.initialize(scenario);
  assert.equal((await owner.execute(edit(1), context)).ok, false);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 2);
  code = "EXPIRED";
  assert.equal((await owner.execute(edit(2), context)).ok, false);
  assert.equal(owner.status.getSnapshot().phase, "expired");
  assert.equal((await owner.execute(edit(2), context)).ok, false);
  assert.equal(starts, 0);
});

test("start and reset turn transport rejection into recoverable results", async () => {
  const owner = createSourceWorkspace({
    baseline,
    request: async () => {
      throw new Error("network");
    },
  });
  const before = owner.state.getSnapshot();
  assert.equal((await owner.start(scenario)).ok, false);
  assert.equal((await owner.reset(scenario)).ok, false);
  assert.equal(owner.state.getSnapshot(), before);
  assert.equal(owner.status.getSnapshot().busy, false);
});

test("a scenario change during automatic start prevents the queued save", async () => {
  const started = deferred();
  const calls = [];
  let current = true;
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      calls.push(name);
      if (name === "WorkspaceStatus")
        return { code: "ABSENT", message: "absent" };
      if (name === "StartWorkspace") return started.promise;
      throw new Error(name);
    },
  });
  const saving = owner.execute(edit(), {
    ...context,
    isCurrent: () => current,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.at(-1), "StartWorkspace");
  current = false;
  started.resolve({ code: "OK", message: "started", workspace });
  assert.equal((await saving).ok, false);
  assert.equal(calls.includes("SaveSource"), false);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 0);
  assert.equal(owner.status.getSnapshot().workspace, null);
});

test("late reset response cannot replace a newer workspace projection", async () => {
  const reset = deferred();
  let currentWorkspace = workspace;
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      if (name === "WorkspaceStatus")
        return { code: "OK", message: "status", workspace: currentWorkspace };
      if (name === "WorkspaceSnapshot")
        return {
          code: "OK",
          message: "loaded",
          workspace: currentWorkspace,
          sources: [entry(2, currentWorkspace.id)],
        };
      if (name === "ResetWorkspace") return reset.promise;
      throw new Error(name);
    },
  });
  await owner.initialize(scenario);
  const resetting = owner.reset(scenario);
  currentWorkspace = { ...workspace, id: "replacement" };
  await owner.initialize(scenario, true);
  reset.resolve({ code: "ABSENT", message: "reset" });
  assert.equal((await resetting).ok, false);
  assert.equal(owner.status.getSnapshot().workspace.id, "replacement");
  assert.equal(
    owner.state.getSnapshot().byId.source.record.title,
    "replacement",
  );
});

test("first hosted hydration replaces the local revision namespace with stored records", async () => {
  let stored = false;
  const owner = createSourceWorkspace({
    baseline,
    request: async (name) => {
      if (name === "WorkspaceStatus")
        return stored
          ? { code: "OK", message: "status", workspace }
          : { code: "LOCAL", message: "local" };
      if (name === "WorkspaceSnapshot")
        return {
          code: "OK",
          message: "loaded",
          workspace,
          sources: [{ ...baseline[0], revision: 0 }],
        };
      throw new Error(name);
    },
  });
  assert.equal((await owner.execute(edit(), context)).ok, true);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 1);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, "Edited");
  stored = true;
  await owner.initialize(scenario, true);
  assert.equal(owner.status.getSnapshot().phase, "active");
  assert.equal(owner.status.getSnapshot().workspace.id, workspace.id);
  assert.equal(owner.status.getSnapshot().generation, 1);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 0);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, "Baseline");
});

const { requestWorkspace } = await import(transport);
const fields = { WorkspaceStatus: 'workspaceStatus', StartWorkspace: 'startWorkspace', ResetWorkspace: 'resetWorkspace', WorkspaceSnapshot: 'workspaceSnapshot', WorkspaceSource: 'workspaceSource', WorkspaceHistory: 'workspaceHistory', SaveSource: 'saveSource', RestoreSource: 'restoreSource' };
const historyEvent = { id: 'event-1', sourceId: 'source', action: 'save', createdAt: workspace.createdAt, expectedRevision: 0, resultRevision: 1, actor: { principalId: 'prin_self', roleId: 'arc_lead', environment: 'res' } };
const reply = (operation, fields = {}) => ({ code: 'OK', message: 'Accepted', workspace, ...(['WorkspaceStatus', 'StartWorkspace', 'ResetWorkspace'].includes(operation) ? { available: true } : operation === 'WorkspaceSnapshot' ? { sources: [entry(1)] } : operation === 'WorkspaceHistory' ? { events: [historyEvent] } : { source: entry(1), ...(['SaveSource', 'RestoreSource'].includes(operation) ? { changed: true, replayed: false } : {}) }), ...fields });
const variables = { id: 'source', sourceId: 'source', input: { id: 'source', idempotencyKey: 'retained-identity' } };
test('fetch receiver admits only the expected operation and owned bounded records', async (t) => {
  let body;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => body }));
  for (const operation of Object.keys(fields)) {
    const wire = reply(operation);
    body = { data: { [fields[operation]]: wire, unrelated: { code: 'INVALID' } } };
    const result = await requestWorkspace(operation, variables, scenario);
    assert.equal(result.code, 'OK', operation);
    assert.notEqual(result.workspace, wire.workspace);
    if (result.source) assert.notEqual(result.source.tags, wire.source.tags);
    if (result.events) assert.notEqual(result.events[0].actor, wire.events[0].actor);
  }
  for (const malformed of [null, {}, { data: [] }, { data: { wrong: reply('WorkspaceHistory') } }, { data: { workspaceHistory: reply('WorkspaceHistory') }, errors: [{ message: 'private server detail' }] },
    ...[
      { code: 'UNKNOWN' }, { message: 'x'.repeat(1001) }, { workspace: { ...workspace, eventCount: -1 } }, { workspace: { ...workspace, expiresAt: workspace.createdAt } },
      { events: {} }, { events: [ { ...historyEvent, actor: null } ] }, { events: [ { ...historyEvent, resultRevision: 3 } ] }, { events: [{ ...historyEvent, sourceId: 'other' }] }, { events: [historyEvent, historyEvent] }, { events: Array(21).fill(historyEvent) },
    ].map(patch => ({ data: { workspaceHistory: reply('WorkspaceHistory', patch) } }))]) {
    body = malformed;
    const result = await requestWorkspace('WorkspaceHistory', variables, scenario);
    assert.equal(result.code, 'UNAVAILABLE');
    assert.equal(result.events, undefined);
    assert.doesNotMatch(result.message, /private server detail/);
  }
  for (const patch of [{ source: { ...entry(1), id: 'other' } }, { source: { ...entry(1), revision: 1.5 } }, { source: { ...entry(1), tags: ['x'.repeat(41)] } }, { source: null }, { changed: 'true' }]) {
    body = { data: { saveSource: reply('SaveSource', patch) } };
    assert.equal((await requestWorkspace('SaveSource', variables, scenario)).code, 'UNAVAILABLE');
  }
  body = { data: { saveSource: { ...reply('SaveSource'), code: 'CONFLICT', source: null, changed: false } } };
  assert.equal((await requestWorkspace('SaveSource', variables, scenario)).code, 'CONFLICT');
});

test('lost fetch save acknowledgement retries the same command and accepts one event', async (t) => {
  let saved = false, lost = true, accepted = 0;
  const keys = [];
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    const request = JSON.parse(init.body);
    const operation = Object.keys(WORKSPACE_OPERATIONS).find(name => WORKSPACE_OPERATIONS[name] === request.extensions.persistedQuery.sha256Hash);
    let value = reply(operation);
    if (operation === 'WorkspaceSnapshot') value = reply(operation, { sources: [entry(saved ? 1 : 0)] });
    if (operation === 'SaveSource') {
      keys.push(request.variables.input.idempotencyKey);
      if (!saved) { saved = true; accepted++; }
      if (lost) { lost = false; throw new Error('lost receipt'); }
      value = reply(operation, { replayed: true, source: { ...entry(1), ...request.variables.input.metadata } });
    }
    return { ok: true, json: async () => ({ data: { [fields[operation]]: value } }) };
  });
  const owner = createSourceWorkspace({ baseline, request: requestWorkspace, newId: () => 'same-command' });
  await owner.initialize(scenario);
  const first = await owner.execute(edit(), context);
  assert.equal(first.ok, false);
  assert.equal(owner.state.getSnapshot().byId.source.revision, 0);
  const second = await owner.execute(edit(), context);
  assert.equal(second.ok, true);
  assert.equal(accepted, 1);
  assert.deepEqual(keys, ['same-command', 'same-command']);
  assert.equal(owner.state.getSnapshot().byId.source.record.title, 'Edited');
});
