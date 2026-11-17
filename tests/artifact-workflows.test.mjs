import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
async function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(
    await readFile(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    },
  );
  for (const [key, value] of Object.entries(imports))
    outputText = outputText
      .replaceAll(`'${key}'`, `'${value}'`)
      .replaceAll(`"${key}"`, `"${value}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const command = await moduleUrl("../src/app/services/command.ts");
const {
  createArtifactWorkflows,
  createArtifactCommands,
  checkArtifactReferences,
} = await import(
  await moduleUrl("../src/app/services/artifactWorkflows.ts", {
    "./command": command,
  })
);
const original = Object.freeze({
  id: "A",
  title: "Pipeline baseline",
  type: "yaml",
  arc: "arc_01",
  pass: 1,
  derivedFrom: ["source"],
  acceptanceChecks: Object.freeze([
    { name: "Scientific review", result: "fail", note: "Recorded finding" },
  ]),
  contentHash: "recorded-hash",
  fileSize: "148 KB",
});
function fixture() {
  const initial = createArtifactWorkflows([
    original,
    { ...original, id: "B", title: "Another artifact" },
  ]);
  let state = initial,
    access = { ok: true },
    sources = [{ id: "source", title: "Current source" }];
  const permissions = [];
  const commands = createArtifactCommands({
    getState: () => state,
    getSources: () => sources,
    commit: (next) => {
      state = next;
    },
    checkPermission: (request) => {
      permissions.push(request);
      return access;
    },
  });
  const execute = (type, fields = {}) =>
    commands.execute({
      type,
      id: "A",
      revision: state.byId.A.revision,
      ...fields,
    });
  return {
    initial,
    execute,
    permissions,
    state: () => state,
    sources: (next) => {
      sources = next;
    },
    deny: () => {
      access = { ok: false, kind: "role", reason: "Viewer cannot edit" };
    },
  };
}
test("local reference checks inspect current metadata and concrete broken links while keeping recorded acceptance intact", () => {
  const f = fixture();
  assert.equal(f.execute("check").ok, true);
  assert.deepEqual(
    f.state().byId.A.localChecks.map((check) => check.result),
    ["pass", "pass"],
  );
  assert.deepEqual(f.permissions, [{ action: "analysis.run", subjectId: "A" }]);
  f.sources([{ id: "source", title: "Updated source" }]);
  f.execute("check");
  assert.equal(f.state().byId.A.localChecks[1].name, "Updated source");
  f.sources([]);
  f.execute("check");
  assert.equal(f.state().byId.A.localChecks[1].result, "fail");
  assert.match(f.state().byId.A.localChecks[1].note, /source/);
  const malformed = checkArtifactReferences(
    { ...original, title: "", derivedFrom: ["A", "", "missing"] },
    [],
    [original],
  );
  assert.deepEqual(
    malformed.map((check) => check.result),
    ["fail", "fail", "fail", "fail"],
  );
  assert.equal(f.state().byId.A.acceptanceChecks, original.acceptanceChecks);
  assert.equal(f.state().byId.A.acceptanceChecks[0].result, "fail");
  assert.equal(f.state().byId.B, f.initial.byId.B);
});
test("a recoverable proposal has a parent and accepted metadata without claiming a generated file", () => {
  const f = fixture();
  assert.equal(f.execute("prepare").ok, true);
  assert.equal(f.state().byId.A.proposal.parentId, "A");
  assert.equal(
    f.execute("save", {
      title: "  Review QC boundaries ",
      change: " Confirm the revised network scope. ",
    }).ok,
    true,
  );
  assert.deepEqual(f.state().byId.A.proposal, {
    parentId: "A",
    title: "Review QC boundaries",
    change: "Confirm the revised network scope.",
  });
  for (const field of [
    "title",
    "pass",
    "contentHash",
    "fileSize",
    "acceptanceChecks",
    "derivedFrom",
  ])
    assert.equal(f.state().byId.A[field], original[field]);
  assert.deepEqual(Object.keys(f.state().byId.A.proposal).sort(), [
    "change",
    "parentId",
    "title",
  ]);
  assert.equal(
    f.permissions.every((request) => request.action === "workspace.edit"),
    true,
  );
  assert.equal(f.execute("discard").ok, true);
  assert.equal(f.state().byId.A.proposal, undefined);
  assert.equal(f.execute("prepare").ok, true);
  assert.match(f.state().byId.A.proposal.title, /Pipeline baseline/);
});
test("fresh permission, identity, stale revision and proposal validation preserve accepted state on refusal", () => {
  const f = fixture();
  for (const id of ["missing", "constructor", "__proto__"])
    assert.equal(f.execute("prepare", { id }).ok, false);
  assert.equal(
    f.execute("save", { title: "Before preparation", change: "Unaccepted" }).ok,
    false,
  );
  f.execute("prepare");
  const prepared = f.state();
  assert.equal(f.execute("discard", { revision: 0 }).kind, "transition");
  assert.equal(f.execute("prepare").ok, false);
  assert.equal(
    f.execute("save", { title: " ", change: "Some change" }).kind,
    "invalid",
  );
  assert.equal(
    f.execute("save", { title: "Valid title", change: "x".repeat(501) }).kind,
    "invalid",
  );
  assert.equal(f.state(), prepared);
  f.deny();
  for (const type of ["check", "prepare", "save", "discard"])
    assert.equal(
      f.execute(type, { title: "Denied title", change: "Denied change" }).kind,
      "role",
    );
  assert.equal(f.state(), prepared);
});
