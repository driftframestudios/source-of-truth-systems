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
const { cohortFacetOptions, createCohortProjection, parseRuleDefinition, withinCohortDraftLimits } =
  await import(rules);
const { createCohortCommands } = await import(
  await moduleUrl("../src/app/services/cohortSession.ts", {
    "./cohortRules": rules,
    "./command": await moduleUrl("../src/app/services/command.ts"),
  })
);
const { createBrowserSession, createSessionState } = await import(
  await moduleUrl("../src/app/services/browserSession.ts")
);
const accessTypes = await moduleUrl("../src/app/types/access.ts");
const access = await moduleUrl("../src/app/services/accessService.ts", {
  "../types/access": accessTypes,
});
const scope = await moduleUrl("../src/app/services/permissionScope.ts", {
  "./accessService": access,
});
const { decidePermission } = await import(
  await moduleUrl("../src/app/services/permissionPolicy.ts", {
    "./permissionScope": scope,
    "../../../shared/permission-scope.mjs": new URL(
      "../shared/permission-scope.mjs",
      import.meta.url,
    ).href,
  })
);
const results = await moduleUrl("../src/app/data/wellResults.ts");
const { STORE } = await import(
  await moduleUrl("../src/app/data/index.ts", { "./wellResults": results })
);
const options = cohortFacetOptions(STORE.specimens);
const pred = (facet, value, negated = false) => ({
  kind: "predicate",
  id: `${facet}-${value}`,
  facet,
  value,
  negated,
});
const rule = (children = [], joiner = "AND") => ({
  name: "  Current cohort  ",
  root: {
    kind: "group",
    id: "root",
    label: "Cohort",
    joiner,
    negated: false,
    children,
  },
});
function fixture() {
  const session = createBrowserSession();
  const resource = { create: () => createSessionState({ rules: [] }) };
  const store = session.get(resource);
  let policy = {
    principalId: "prin_self",
    role: "arc_lead",
    environment: "res",
  };
  let nextId = 0;
  const requests = [];
  const commands = createCohortCommands({
    getState: store.getSnapshot,
    commit: (next) => store.update(() => next),
    options,
    newId: () => `cohort-${++nextId}`,
    checkPermission: (request) => {
      requests.push(request);
      return decidePermission({ ...policy, ...request });
    },
  });
  return {
    commands,
    state: store.getSnapshot,
    reopen: () => session.get(resource),
    requests,
    policy: (patch) => {
      policy = { ...policy, ...patch };
    },
  };
}

test("accepted definitions survive receiver remounts, update exactly, and remove independently", () => {
  const f = fixture();
  const draft = rule([pred("priority", "stat")]);
  const first = f.commands.execute({ type: "create", definition: draft });
  assert.deepEqual(first, { ok: true, id: "cohort-1", revision: 0 });
  draft.root.children[0].value = "routine";
  assert.equal(
    f.reopen().getSnapshot().rules[0].root.children[0].value,
    "stat",
  );
  assert.equal(f.state().rules[0].name, "Current cohort");
  f.commands.execute({
    type: "create",
    definition: rule([pred("consent", "active")]),
  });
  const untouched = f.state().rules[0];
  const updated = f.commands.execute({
    type: "update",
    id: first.id,
    revision: 0,
    definition: {
      ...rule([pred("orderState", "on_hold")]),
      name: "Held orders",
    },
  });
  assert.equal(updated.revision, 1);
  assert.equal(f.state().rules[0], untouched);
  assert.equal(f.state().rules[1].name, "Held orders");
  const accepted = f.state();
  assert.equal(
    f.commands.execute({
      type: "update",
      id: first.id,
      revision: 0,
      definition: rule(),
    }).kind,
    "transition",
  );
  assert.equal(
    f.commands.execute({ type: "remove", id: first.id, revision: 0 }).kind,
    "transition",
  );
  assert.equal(f.state(), accepted);
  assert.equal(
    f.commands.execute({ type: "remove", id: first.id, revision: 1 }).ok,
    true,
  );
  assert.deepEqual(f.state().rules, [untouched]);
  assert.equal(
    f.commands.execute({ type: "remove", id: first.id, revision: 1 }).kind,
    "missing",
  );
});

test("current role and environment govern create, update and remove at command time", () => {
  const f = fixture();
  const accept = f.commands.execute;
  const created = accept({ type: "create", definition: rule() });
  const accepted = f.state();
  for (const patch of [
    { role: "viewer" },
    { role: "arc_lead", environment: "val" },
  ]) {
    f.policy(patch);
    for (const command of [
      { type: "create", definition: rule() },
      { type: "update", id: created.id, revision: 0, definition: rule() },
      { type: "remove", id: created.id, revision: 0 },
    ])
      assert.equal(accept(command).ok, false);
  }
  assert.equal(f.state(), accepted);
  assert.deepEqual(f.requests.at(-1), {
    action: "workspace.edit",
    subjectId: created.id,
  });
});

test("malformed or unbounded definitions stay outside accepted state", () => {
  const f = fixture();
  const before = f.state();
  const cycle = rule();
  cycle.root.children.push(cycle.root);
  const invalid = [
    null,
    {},
    { ...rule(), name: " " },
    { ...rule(), name: "x".repeat(121) },
    rule([pred("constructor", "true")]),
    rule([pred("orderState", "anything")]),
    rule([pred("priority", "stat"), pred("priority", "stat")]),
    rule([pred("tumorPercent", "NaN")]),
    rule(
      Array.from({ length: 129 }, (_, id) => ({
        ...pred("priority", "stat"),
        id: String(id),
      })),
    ),
    { ...rule(), root: { ...rule().root, joiner: "XOR" } },
    cycle,
  ];
  for (const definition of invalid)
    assert.equal(f.commands.execute({ type: "create", definition }).ok, false);
  assert.equal(f.state(), before);
  assert.deepEqual(
    parseRuleDefinition({ ...rule(), sql: "ignored" }, options),
    { name: "Current cohort", root: rule().root },
  );
});

test('draft admission bounds cards and depth before recursive consumers, retaining editable labels', () => {
  const leaves = Array.from({length:127}, (_,index) => ({...pred('priority','stat'),id:`p-${index}`}));
  const largest = rule(leaves).root;
  assert.equal(withinCohortDraftLimits(largest), true);
  assert.equal(withinCohortDraftLimits({...largest,children:[...leaves,{...pred('priority','stat'),id:'extra'}]}), false);
  let nested = pred('priority','stat');
  for (let depth = 0; depth < 8; depth++) nested = {...rule([nested]).root,id:`depth-${depth}`};
  assert.equal(withinCohortDraftLimits(nested), true);
  assert.equal(withinCohortDraftLimits({...rule([nested]).root,id:'too-deep'}), false);
  const cycle = rule().root;
  cycle.children.push(cycle);
  assert.equal(withinCohortDraftLimits(cycle), false);
  assert.equal(withinCohortDraftLimits({...rule().root,label:''}), true);
});

test("loaded definitions recompute against current specimen and biomarker state and partition consent holds", () => {
  const f = fixture();
  const active = {
    ...STORE.specimens[0],
    id: "active",
    consent: "active",
    orderState: "in_progress",
  };
  const held = { ...active, id: "held", consent: "rescinded" };
  const draft = rule([pred("orderState", "on_hold")]);
  f.commands.execute({ type: "create", definition: draft });
  const saved = f.reopen().getSnapshot().rules[0];
  assert.deepEqual(
    createCohortProjection([active, held], []).match(saved.root).matched,
    [],
  );
  const updated = [
    { ...active, orderState: "on_hold" },
    { ...held, orderState: "on_hold" },
  ];
  const match = createCohortProjection(updated, []).match(saved.root);
  assert.deepEqual(
    match.matched.map((s) => s.id),
    ["active", "held"],
  );
  assert.deepEqual(
    match.eligible.map((s) => s.id),
    ["active"],
  );
  assert.deepEqual(
    match.held.map((s) => s.id),
    ["held"],
  );
  const review = rule([pred("biomarkerReview", "approved")]);
  const marker = {
    ...STORE.biomarkers[0],
    specimenId: "active",
    reviewState: "in_review",
  };
  assert.equal(createCohortProjection(updated, [marker]).count(review.root), 0);
  assert.equal(
    createCohortProjection(updated, [
      { ...marker, reviewState: "approved" },
    ]).count(review.root),
    1,
  );
  const consentOnly = rule([pred("consent", "active", true)]);
  assert.equal(
    createCohortProjection(updated, []).match(consentOnly.root).eligible.length,
    0,
  );
});

test("nested AND/OR/NOT and explicit metric targets retain the existing tumor-board result", () => {
  const projection = createCohortProjection(STORE.specimens, STORE.biomarkers);
  const root = rule([
    {
      ...rule(
        [
          pred("biomarkerTier", "tier_1"),
          pred("biomarkerCategory", "signature"),
        ],
        "OR",
      ).root,
      id: "actionable",
    },
    pred("coverageMet", "true"),
    pred("consent", "rescinded", true),
  ]).root;
  const matches = projection.match(root);
  assert.equal(matches.matched.length, 4);
  assert.equal(matches.eligible.length, 3);
  assert.equal(matches.held.length, 1);
  assert.equal(projection.countFacet("coverageMet", "true"), 7);
});
