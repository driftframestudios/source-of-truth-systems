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
const command = await moduleUrl("../src/app/services/command.ts");
const { createSourceSession, createSourceCommands, selectSources } =
  await import(
    await moduleUrl("../src/app/services/sourceSession.ts", {
    "../../../shared/workspace-contract.mjs": new URL("../shared/workspace-contract.mjs", import.meta.url).href,
      "./command": command,
    })
  );
const policyKernel = new URL("../shared/permission-scope.mjs", import.meta.url)
  .href;
const types = await moduleUrl("../src/app/types/access.ts");
const access = await moduleUrl("../src/app/services/accessService.ts", {
  "../types/access": types,
});
const scope = await moduleUrl("../src/app/services/permissionScope.ts", {
  "./accessService": access,
});
const { decidePermission } = await import(
  await moduleUrl("../src/app/services/permissionPolicy.ts", {
    "./permissionScope": scope,
    "../../../shared/permission-scope.mjs": policyKernel,
  })
);

const original = Object.freeze({
  id: "source-a",
  title: "Program brief",
  description: "Bundled source summary.",
  tags: Object.freeze(["genomics"]),
  role: "scientific_authority",
  type: "scientific_ref",
  status: "active",
  lastUpdated: "2026-01-01",
  confidenceScore: 91,
  trustScope: Object.freeze(["scientific_terminology"]),
  notAuthoritativeFor: Object.freeze(["artifact_state"]),
});
const other = { ...original, id: "source-b", title: "Other source" };
const metadata = {
  title: "  Updated brief  ",
  description: " Clear local summary. ",
  tags: ["review", " review "],
};
function fixture() {
  let state = createSourceSession([original, other]);
  let policy = {
    principalId: "prin_self",
    role: "arc_lead",
    environment: "res",
  };
  let commits = 0;
  const requests = [];
  const commands = createSourceCommands({
    baseline: [original, other],
    getState: () => state,
    commit: (next) => {
      state = next;
      commits++;
    },
    checkPermission: (request) => {
      requests.push(request);
      return decidePermission({ ...policy, ...request });
    },
  });
  return {
    commands,
    state: () => state,
    policy: (next) => {
      policy = { ...policy, ...next };
    },
    commits: () => commits,
    requests,
  };
}
const edit = { type: "edit", id: "source-a", revision: 0, metadata };

test("metadata editing updates its exact source while preserving provenance and authority", () => {
  const f = fixture();
  const untouched = f.state().byId["source-b"];
  assert.deepEqual(
    f.commands.execute({
      ...edit,
      metadata: {
        ...metadata,
        id: "forged",
        role: "context_only",
        confidenceScore: 0,
        trustScope: ["artifact_state"],
      },
    }),
    { ok: true, changed: true },
  );
  assert.deepEqual(f.state().byId["source-a"], {
    revision: 1,
    record: {
      ...original,
      title: "Updated brief",
      description: "Clear local summary.",
      tags: ["review"],
    },
  });
  assert.equal(f.state().byId["source-b"], untouched);
  assert.equal(original.title, "Program brief");
  assert.deepEqual(
    selectSources(f.state()).map((record) => record.title),
    ["Updated brief", "Other source"],
  );
  assert.deepEqual(f.requests, [
    { action: "workspace.edit", subjectId: "source-a" },
  ]);
});

test("a saved draft rechecks current role and environment at command acceptance", () => {
  const f = fixture();
  const before = f.state();
  const accept = f.commands.execute;
  assert.equal(f.commands.check(edit).ok, true);
  f.policy({ role: "viewer" });
  assert.equal(accept(edit).kind, "role");
  f.policy({ role: "arc_lead", environment: "val" });
  assert.equal(accept(edit).kind, "environment");
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});

test("restoring the bundled record is exact and stale revisions preserve accepted metadata", () => {
  const f = fixture();
  f.commands.execute(edit);
  const accepted = f.state();
  assert.equal(
    f.commands.execute({
      ...edit,
      metadata: { ...metadata, title: "Stale draft" },
    }).kind,
    "transition",
  );
  assert.equal(
    f.commands.execute({ type: "restore", id: "source-a", revision: 0 }).kind,
    "transition",
  );
  assert.equal(f.state(), accepted);
  f.policy({ role: "viewer" });
  assert.equal(
    f.commands.execute({ type: "restore", id: "source-a", revision: 1 }).kind,
    "role",
  );
  assert.equal(f.state(), accepted);
  f.policy({ role: "arc_lead" });
  assert.equal(
    f.commands.execute({ type: "restore", id: "source-a", revision: 1 }).ok,
    true,
  );
  assert.deepEqual(f.state().byId["source-a"], {
    record: original,
    revision: 2,
  });
  assert.equal(f.state().byId["source-b"], accepted.byId["source-b"]);
});

test("unknown records and malformed metadata cannot enter the source projection", () => {
  const f = fixture();
  const before = f.state();
  for (const input of [
    null,
    { ...edit, type: "constructor" },
    { ...edit, id: "toString" },
    { ...edit, revision: -1 },
    { ...edit, metadata: null },
    { ...edit, metadata: { ...metadata, title: " " } },
    { ...edit, metadata: { ...metadata, tags: Array(13).fill("tag") } },
    { ...edit, metadata: { ...metadata, tags: ["x".repeat(41)] } },
  ]) {
    assert.equal(f.commands.execute(input).ok, false);
  }
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});

test("unchanged metadata and repeated baseline reads return a truthful unchanged result", () => {
  const f = fixture();
  const before = f.state();
  assert.deepEqual(
    f.commands.execute({ type: "restore", id: "source-a", revision: 0 }),
    { ok: true, changed: false },
  );
  assert.deepEqual(f.commands.execute({ ...edit, metadata: original }), {
    ok: true,
    changed: false,
  });
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});

test("metadata rejects unsupported Unicode without changing text or accepted state", () => {
  const f = fixture();
  const before = f.state();
  for (const value of [
    "Hidden\u0000text",
    "Incomplete\uD800",
    "\uDC00character",
  ]) {
    for (const field of ["title", "description", "tags"]) {
      const draft = {
        ...metadata,
        [field]: field === "tags" ? [value] : value,
      };
      const originalDraft = structuredClone(draft);
      const result = f.commands.execute({ ...edit, metadata: draft });
      assert.equal(result.ok, false);
      assert.equal(result.kind, "invalid");
      assert.deepEqual(
        draft,
        originalDraft,
        "validation preserves the visitor's draft",
      );
    }
  }
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
  const unicode = {
    title: "Génome 🧬",
    description: "患者の記録 — α",
    tags: ["🧪", "données"],
  };
  assert.equal(f.commands.execute({ ...edit, metadata: unicode }).ok, true);
  const { title, description, tags } = f.state().byId["source-a"].record;
  assert.deepEqual({ title, description, tags }, unicode);
});
