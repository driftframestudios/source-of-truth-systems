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

const { COHORT_FACET_IDS, cohortFacet, emptyRuleText, toExpression, countPredicates, createRuleFactory, createCohortPresets, inspectRuleDefinition } = await import(rules);
test('facet semantics, expression and empty-group explanation agree with independent results', () => {
  for (const joiner of ['AND', 'OR']) for (const negated of [false, true]) {
    const root = { ...rule([], joiner).root, negated };
    assert.equal(createCohortProjection(STORE.specimens, []).count(root), negated ? 0 : STORE.specimens.length);
    assert.equal(toExpression(root), negated ? 'NOT TRUE' : 'TRUE');
    assert.equal(emptyRuleText(root), negated ? 'Empty negated group — no specimens match' : 'Empty — all specimens match');
  }
  const specimens = [
    { ...STORE.specimens[0], id: 'equal', tumorPercent: 30, variantsCalled: 50, consent: 'active' },
    { ...STORE.specimens[0], id: 'held', tumorPercent: 70, variantsCalled: 1, consent: 'pending' },
    { ...STORE.specimens[0], id: 'missing', tumorPercent: undefined, variantsCalled: undefined, consent: 'active' },
  ];
  const root = rule([{ ...rule([pred('tumorPercent', '30'), pred('variantsCalled', '50')], 'OR').root, id: 'choice' }, pred('consent', 'rescinded', true)]).root;
  const result = createCohortProjection(specimens, []).match(root);
  assert.deepEqual(result.matched.map(s => s.id), ['equal', 'held']);
  assert.deepEqual(result.eligible.map(s => s.id), ['equal']);
  assert.deepEqual(result.held.map(s => s.id), ['held']);
  assert.equal(toExpression(root), '(tumorPercent>=30 OR variantsCalled>=50) AND NOT consent=rescinded');
  assert.equal(countPredicates(root), 3);
  for (const id of COHORT_FACET_IDS) {
    assert.ok(cohortFacet(id).label);
    assert.ok(options[id].length);
    for (const value of options[id]) assert.ok(Number.isInteger(createCohortProjection(STORE.specimens, STORE.biomarkers).count(pred(id, value))));
  }
});

test('preset factories allocate independent identities and admission reports a bounded offending path', () => {
  let next = 0;
  const factory = createRuleFactory(kind => `${kind}-${++next}`);
  const presets = createCohortPresets(factory);
  for (const preset of presets) {
    const original = { name: preset.label, root: preset.build(), ignored: 'transport extra' };
    const second = preset.build();
    assert.notEqual(original.root.children[0].id, second.children[0].id);
    const accepted = parseRuleDefinition(JSON.parse(JSON.stringify(original)), options);
    assert.deepEqual(accepted, { name: original.name, root: original.root });
    assert.notEqual(accepted.root, original.root);
    assert.equal(toExpression(accepted.root), toExpression(second));
  }
  const invalid = rule([pred('priority', 'unknown')]);
  assert.deepEqual(inspectRuleDefinition(invalid, options).finding, { code: 'facet-value', path: [0], nodeId: 'priority-unknown' });
  assert.equal(inspectRuleDefinition(rule([pred('priority', 'stat'), pred('priority', 'stat')]), options).finding.code, 'duplicate-id');
});

test('all-node analysis shares leaf work at admitted depth and reuses unchanged tree snapshots', () => {
  let reads = 0;
  const specimens = Array.from({ length: 100 }, (_, id) => ({ ...STORE.specimens[0], id: String(id), get tumorPercent() { reads++; return 70; } }));
  let next = 0;
  const factory = createRuleFactory(kind => `${kind}${++next}`);
  let root = factory.group(Array.from({ length: 120 }, () => factory.predicate('tumorPercent', '30')));
  for (let depth = 0; depth < 7; depth++) root = factory.group([root]);
  assert.equal(withinCohortDraftLimits(root), true); // 128 nodes, leaf depth 8
  const projection = createCohortProjection(specimens, []);
  const analysis = projection.analyze(root);
  assert.equal(reads, 12000);
  assert.equal(analysis.counts.size, 128);
  assert.equal(analysis.counts.get(root.id), 100);
  assert.equal(analysis.predicates, 120);
  for (let selection = 0; selection < 5; selection++) assert.equal(projection.analyze(root), analysis);
  assert.equal(reads, 12000);
  const saved = projection.summary(root);
  const afterSummary = reads;
  assert.equal(projection.summary(root), saved);
  assert.equal(reads, afterSummary);
  assert.equal(projection.countFacet('tumorPercent', '30'), 100);
  const afterPalette = reads;
  projection.countFacet('tumorPercent', '30');
  assert.equal(reads, afterPalette);
  assert.notEqual(projection.analyze({ ...root, negated: true }), analysis);
  assert.notEqual(projection.analyze(root), analysis); // reopening a saved root recomputes after another root
  assert.equal(projection.summary(root), saved);
  assert.notEqual(createCohortProjection(specimens, []).analyze(root), analysis);
});

test('fused counts preserve nested negation, consent holds and current record analysis', () => {
  const projection = createCohortProjection(STORE.specimens, STORE.biomarkers);
  const factory = createRuleFactory((() => { let id=0; return kind => `${kind}${++id}`; })());
  const roots = createCohortPresets(factory).map(p => p.build());
  roots.push({ ...rule([], 'OR').root, negated: true });
  for (const root of roots) {
    const analysis = projection.analyze(root);
    assert.deepEqual(analysis.matched, projection.match(root).matched);
    const visit = node => { assert.equal(analysis.counts.get(node.id), projection.count(node)); if (node.kind === 'group') node.children.forEach(visit); };
    visit(root);
    assert.equal(projection.summary(root).eligible, analysis.eligible.length);
    assert.equal(projection.summary(root).held, analysis.held.length);
  }
  assert.equal(projection.analyze(roots[0]).matched.length, 4);
  assert.equal(projection.analyze(roots[0]).eligible.length, 3);
  const approved = factory.group([factory.predicate('biomarkerReview', 'approved')]);
  const before = createCohortProjection(STORE.specimens, []).analyze(approved);
  const after = createCohortProjection(STORE.specimens, [{ ...STORE.biomarkers[0], reviewState: 'approved' }]).analyze(approved);
  assert.equal(before.matched.length, 0);
  assert.equal(after.matched.length, 1);
});


test('cohort refusals expose stable identity and bounded editor findings', () => {
  const f = fixture();
  const accepted = f.commands.execute({ type: 'create', definition: rule() });
  const before = f.state();
  const stale = f.commands.execute({ type: 'update', id: accepted.id, revision: 7, definition: rule() });
  assert.equal(stale.code, 'STALE_REVISION');
  const invalid = f.commands.execute({ type: 'create', definition: rule([pred('priority', 'wrong')]) });
  assert.equal(invalid.code, 'INVALID_INPUT');
  assert.deepEqual(invalid.details.path, [0]);
  assert.equal(invalid.details.nodeId, 'priority-wrong');
  assert.equal(invalid.details.finding, 'facet-value');
  assert.match(invalid.reason, /128 cards and 8 nested levels/);
  assert.equal(f.state(), before);
  f.policy({ role: 'viewer' });
  assert.equal(f.commands.execute({ type: 'create', definition: rule() }).code, 'PERMISSION_DENIED');
});
