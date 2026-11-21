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
const types = await moduleUrl("../src/app/types/index.ts");
const quality = await moduleUrl("../src/app/services/specimenQuality.ts");
const rules = await moduleUrl("../src/app/services/cohortRules.ts", {
  "../types": types,
  "./specimenQuality": quality,
});
const { createCohortEditor: create, cohortEditorReducer: reduce } =
  await import(
    await moduleUrl("../src/app/services/cohortEditor.ts", {
      "./cohortRules": rules,
    })
  );
const { parseRuleDefinition } = await import(rules);
const leaf = (id) => ({
  kind: "predicate",
  id,
  facet: "priority",
  value: "stat",
  negated: false,
});
const group = (id, children = []) => ({
  kind: "group",
  id,
  children,
  joiner: "AND",
  label: id,
  negated: false,
});
const select = (state, id) => reduce(state, { type: "select", id });

test("removing a focused ancestor returns to its nearest surviving group and admits the next card", () => {
  const sibling = group("sibling", [leaf("kept")]);
  let state = create(
    group("custom-root", [
      group("outer", [
        group("removed", [group("focused", [leaf("selected")])]),
      ]),
      sibling,
    ]),
  );
  state = reduce(select(state, "selected"), { type: "focus", id: "focused" });
  state = reduce(state, { type: "remove", id: "removed" });
  assert.equal(state.focusId, "outer");
  assert.equal(state.selected.size, 0);
  assert.equal(state.root.children[1], sibling);
  state = reduce(state, { type: "add", id: state.focusId, node: leaf("new") });
  assert.deepEqual(
    state.root.children[0].children.map((n) => n.id),
    ["new"],
  );
});

test("linking preserves sibling order; unlinking retires only the dissolved group identity", () => {
  let state = create(group("r", [leaf("a"), leaf("b"), leaf("c"), leaf("d")]));
  state = select(select(state, "d"), "b");
  state = reduce(state, {
    type: "link",
    id: "linked",
    joiner: "OR",
    label: "Linked",
  });
  assert.deepEqual(
    state.root.children.map((n) => n.id),
    ["a", "linked", "c"],
  );
  assert.deepEqual(
    state.root.children[1].children.map((n) => n.id),
    ["b", "d"],
  );
  assert.equal(state.selected.size, 0);
  state = reduce(select(select(state, "linked"), "b"), {
    type: "focus",
    id: "linked",
  });
  state = reduce(state, { type: "unlink", id: "linked" });
  assert.equal(state.focusId, "r");
  assert.deepEqual([...state.selected], ["b"]);
  assert.deepEqual(
    state.root.children.map((n) => n.id),
    ["a", "b", "d", "c"],
  );
});

test("stale IDs and root-only actions retain identity; open and clear use the supplied root", () => {
  const parsed = parseRuleDefinition(
    { name: "Other root", root: group("accepted-id", [leaf("a")]) },
    { priority: ["stat"] },
  );
  let state = create(parsed.root);
  for (const type of ["focus", "select", "remove", "unlink"])
    assert.equal(reduce(state, { type, id: "missing" }), state);
  for (const type of ["select", "remove", "unlink"])
    assert.equal(reduce(state, { type, id: state.root.id }), state);
  assert.equal(
    reduce(state, { type: "update", id: "a", update: (n) => n }),
    state,
  );
  state = select(state, "a");
  state = reduce(state, { type: "open", root: group("next") });
  assert.equal(state.focusId, "next");
  assert.equal(state.selected.size, 0);
  state = reduce(state, {
    type: "open",
    root: { ...state.root, children: [] },
  });
  assert.equal(state.focusId, "next");
});

test("rejected cross-parent links and bounded additions preserve the draft and selection", () => {
  let state = create(group("r", [group("g", [leaf("a")]), leaf("b")]));
  state = select(select(state, "a"), "b");
  const denied = reduce(state, {
    type: "link",
    id: "new",
    joiner: "AND",
    label: "Linked",
  });
  assert.equal(denied.issue, "siblings");
  assert.equal(denied.root, state.root);
  assert.equal(denied.selected, state.selected);
  state = create(
    group(
      "r",
      Array.from({ length: 127 }, (_, i) => leaf(`p${i}`)),
    ),
  );
  const full = reduce(state, { type: "add", id: "r", node: leaf("overflow") });
  assert.equal(full.issue, "limit");
  assert.equal(full.root, state.root);
  let deep = leaf("end");
  for (let i = 0; i < 8; i++) deep = group(`g${i}`, [deep]);
  state = create(deep);
  const tooDeep = reduce(state, {
    type: "add",
    id: "g0",
    node: group("extra", [leaf("too-deep")]),
  });
  assert.equal(tooDeep.issue, "limit");
  assert.equal(tooDeep.root, state.root);
  assert.equal(
    reduce(state, {
      type: "update",
      id: "g0",
      update: (n) => ({ ...n, label: "" }),
    }).root.children[0].id,
    "g6",
  );
});
