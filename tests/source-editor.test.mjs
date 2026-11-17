import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });
  for (const [name, url] of Object.entries(imports))
    outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const browser = await moduleUrl("../src/app/services/browserSession.ts");
const { createSourceEditor } = await import(
  await moduleUrl("../src/app/services/sourceEditor.ts", {
    "./browserSession": browser,
  })
);
const entry = (id = "one", revision = 0, title = "Bundled source") => ({
  record: { id, title, description: "Summary", tags: ["genomics"] },
  revision,
});

test("returning to a draft retains its text and submitted revision, independently of accepted records", () => {
  const owner = createSourceEditor();
  owner.open(entry(), "local");
  owner.edit("one", 1, { title: "Unfinished title" });
  owner.hide();
  owner.open(entry("two"), "local");
  owner.edit("two", 3, { description: "Other draft" });
  owner.open(entry("one", 2, "New accepted title"), "local");
  const draft = owner.state.getSnapshot().drafts.get("one");
  assert.equal(draft.title, "Unfinished title");
  assert.equal(
    draft.revision,
    0,
    "a newer accepted revision must still produce a conflict on an old draft",
  );
  assert.equal(
    owner.state.getSnapshot().drafts.get("two").description,
    "Other draft",
  );
});

test("cancel and a later editor generation protect the current draft from an earlier completion", () => {
  const owner = createSourceEditor();
  owner.open(entry(), "local");
  owner.finish("one", 1);
  owner.open(entry(), "local");
  owner.edit("one", 3, { title: "New draft" });
  owner.finish("one", 1, "Old saved notice");
  owner.notify(1, "Old refusal");
  owner.edit("one", 1, { title: "Late text" });
  assert.equal(owner.state.getSnapshot().activeId, "one");
  assert.equal(owner.state.getSnapshot().drafts.get("one").title, "New draft");
  assert.equal(owner.state.getSnapshot().notice, "");
});

test("workspace recovery preserves the active draft; reopening a dormant draft uses the new namespace", () => {
  const owner = createSourceEditor();
  owner.open(entry("one", 2), "old");
  owner.edit("one", 1, { title: "Keep during explicit recovery" });
  owner.rebase("one", 1, "new", 0);
  assert.equal(
    owner.state.getSnapshot().drafts.get("one").title,
    "Keep during explicit recovery",
  );
  assert.equal(owner.state.getSnapshot().drafts.get("one").revision, 0);
  owner.rebase("one", 1, "new", 3);
  assert.equal(
    owner.state.getSnapshot().drafts.get("one").revision,
    0,
    "same-namespace refresh preserves conflict detection",
  );
  owner.hide();
  owner.open(entry("one", 0, "Other workspace baseline"), "third");
  assert.equal(
    owner.state.getSnapshot().drafts.get("one").title,
    "Other workspace baseline",
  );
  assert.equal(owner.state.getSnapshot().drafts.get("one").namespace, "third");
});
