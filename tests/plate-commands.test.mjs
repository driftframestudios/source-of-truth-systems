import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`).replaceAll(`"${specifier}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const policyKernel = new URL('../shared/permission-scope.mjs', import.meta.url).href;
const accessTypes = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', { '../types/access': accessTypes });
const results = await moduleUrl('../src/app/data/wellResults.ts');
const availability = await moduleUrl('../src/app/services/dataAvailability.ts', { '../types/access': accessTypes, './accessService': access, '../data/wellResults': results });
const overlayModule = await moduleUrl('../src/app/components/plate/plateOverlayState.ts');
const historyRecords = await moduleUrl('../src/app/services/plateHistory/records.ts');
const { createPlateOverlayState, plateOverlayReducer } = await import(overlayModule);
const { createPlateCommands } = await import(await moduleUrl('../src/app/components/plate/plateCommands.ts', { '../../services/dataAvailability': availability, './plateOverlayState': overlayModule, '../../services/plateHistory/records': historyRecords }));
const { historyKey, projectPlateHistories, resolvePlateResult } = await import(historyRecords);
const { resolveArtifact } = await import(availability);
const scopeModule = await moduleUrl('../src/app/services/permissionScope.ts', { './accessService': access });
const { permissionCatalog } = await import(scopeModule);
const { deriveScenario, decideScopedPermission } = await import(policyKernel);
const { decidePermission } = await import(await moduleUrl('../src/app/services/permissionPolicy.ts', { '../types/access': accessTypes, './accessService': access, './permissionScope': scopeModule, '../../../shared/permission-scope.mjs': policyKernel }));

const plateId = 'anchor-plate';
const now = '2026-09-28T09:00:00Z';
const artifact = Object.freeze({ kind: 'bam', key: 'bam/shared.bam', createdAt: '2026-05-31', ruleId: 'lc-bam-v3', sizeBytes: 1e9 });
const canonical = Object.freeze({ id: 'result-one', wellId: 'C3', plateId: 'earlier-physical-run', label: 'P', consent: 'active', status: 'reportable', runDate: '2025-05-31', artifacts: Object.freeze([artifact, { kind: 'vcf', key: 'vcf/result.vcf', createdAt: '2026-05-31', ruleId: 'lc-vcf-hot', sizeBytes: 1e6 }]) });
const target = { plateId, wellId: canonical.wellId, resultId: canonical.id };
const restore = { type: 'artifact.restore', target, artifactKind: 'bam', tier: 'standard' };

function fixture({ clipboardError = false, owner = result => ({ geography: 'us_east', consent: result.consent }), checkPermission = (scenario, request) => decidePermission({ ...scenario, ...request }) } = {}) {
  let state = createPlateOverlayState();
  let scenario = { principalId: 'prin_self', role: 'arc_lead', environment: 'res' };
  const cache = new Map();
  const examples = new Map([[canonical.wellId, [canonical]]]);
  const accepted = [], copied = [], policy = [];
  let writes = 0;
  const commands = createPlateCommands({
    resolve: (ref) => resolvePlateResult(ref, plateId, examples, cache),
    getState: () => state,
    getOwner: owner,
    check: (request) => { policy.push(request); return checkPermission(scenario, request); },
    getBucket: () => 'synthetic-streams',
  }, {
    now: () => now, clock: () => 1000,
    commit: (action) => { const next = plateOverlayReducer(state, action); if (next === state) return false; state = next; return true; },
    accepted: (command) => accepted.push(command),
    copy: async (uri) => { writes++; if (clipboardError) throw new Error('Clipboard rejected'); copied.push(uri); }, copied: () => {},
  });
  return { commands, cache, examples, accepted, copied, policy, state: () => state, writes: () => writes, scenario: (next) => { scenario = { ...scenario, ...next }; } };
}

test('current canonical history supplies consent and derived restore tier, not caller objects', async () => {
  const f = fixture();
  assert.equal(f.commands.preview(restore).ok, true);
  const accepted = await f.commands.execute({ ...restore, option: { minHours: 0 }, result: { consent: 'active' } });
  assert.deepEqual(accepted, { ok: true, changed: true });
  assert.equal(f.state().restores[artifact.key].readyAt, '2026-09-28T13:00:00.000Z');
  assert.equal(f.policy[0].resource, 'bam_cram');
  assert.equal(f.policy[0].geography, 'us_east');
  assert.equal(f.accepted.length, 1);
  assert.equal((await f.commands.execute(restore)).kind, 'transition');
  assert.equal(f.accepted.length, 1);
});

test('a permission change between preview and acceptance leaves state and effects untouched', async () => {
  const f = fixture();
  assert.equal(f.commands.preview(restore).ok, true);
  const initial = f.state();
  f.scenario({ role: 'viewer' });
  assert.equal((await f.commands.execute(restore)).kind, 'role');
  assert.equal(f.state(), initial);
  assert.deepEqual(f.accepted, []);
  f.scenario({ role: 'arc_lead', environment: 'val' });
  assert.equal((await f.commands.execute({ type: 'query.repair', target })).kind, 'environment');
  assert.equal(f.state(), initial);
  assert.deepEqual(f.accepted, []);
});

test('fetched-only result IDs resolve, while loaded empty histories retire former example commands', async () => {
  const f = fixture();
  const stored = { ...canonical, id: 'stored-result' };
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [stored] });
  assert.equal((await f.commands.execute(restore)).kind, 'missing');
  assert.equal((await f.commands.execute({ ...restore, target: { ...target, resultId: stored.id } })).ok, true);
  assert.deepEqual(f.accepted[0].result, stored);
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: true, results: [] });
  assert.equal((await f.commands.execute({ ...restore, target: { ...target, resultId: stored.id } })).kind, 'missing');
  assert.equal(resolvePlateResult({ ...target, plateId: canonical.plateId }, plateId, f.examples, f.cache), undefined);
});

test('every fetched well projects consistently with canonical command lookup, including empty records', () => {
  const f = fixture();
  const stored = { ...canonical, id: 'stored-result' };
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [stored] });
  f.cache.set(historyKey(plateId, 'D4'), { mode: 'STORED', missing: false, results: [] });
  f.cache.set(historyKey('unrelated', 'D4'), { mode: 'STORED', missing: false, results: [canonical] });
  const projected = projectPlateHistories(plateId, f.examples, f.cache);
  assert.equal(projected.get('C3')[0], stored);
  assert.equal(projected.get('C3')[0], resolvePlateResult({ ...target, resultId: stored.id }, plateId, f.examples, f.cache));
  assert.deepEqual(projected.get('D4'), []);
  assert.equal(f.examples.get('C3')[0], canonical);
});

test('latest result hold wins over broad roles and another alias restoring shared bytes', async () => {
  const f = fixture();
  await f.commands.execute(restore);
  const state = f.state();
  const held = { ...canonical, consent: 'rescinded' };
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [held] });
  f.scenario({ role: 'admin' });
  for (const command of [restore, { type: 'query.repair', target }, { type: 'artifact.copyUri', target, artifactKind: 'bam' }]) {
    assert.equal((await f.commands.execute(command)).kind, 'consent');
  }
  assert.equal(f.state(), state);
  assert.equal(f.accepted.length, 1);
  assert.equal(f.writes(), 0);
  assert.equal(resolveArtifact({ ...artifact, restore: state.restores[artifact.key] }, held).state, 'held');
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [{ ...canonical, status: 'held' }] });
  assert.equal((await f.commands.execute({ type: 'query.repair', target })).kind, 'consent');
});

test('invalid restore tiers and mismatched query actions never reach the accepted effects', async () => {
  const f = fixture();
  const initial = f.state();
  assert.equal((await f.commands.execute({ ...restore, tier: 'invalid' })).kind, 'invalid');
  assert.equal((await f.commands.execute({ type: 'query.rebuild', target })).kind, 'transition');
  assert.equal((await f.commands.execute({ type: 'invented', target })).kind, 'invalid');
  assert.equal(f.state(), initial);
  assert.deepEqual(f.accepted, []);
  assert.equal((await f.commands.execute({ type: 'query.repair', target })).ok, true);
  assert.equal(f.accepted[0].type, 'query.repair');
  assert.equal(f.state().athena[canonical.id].completion.at, 3400);
  assert.equal((await f.commands.execute({ type: 'query.repair', target })).kind, 'transition');
  assert.equal(f.accepted.length, 1);
  const deep = fixture();
  deep.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [{ ...canonical, artifacts: [{ ...artifact, createdAt: '2025-05-31' }] }] });
  assert.equal((await deep.commands.execute({ ...restore, tier: 'expedited' })).kind, 'transition');
  assert.deepEqual(deep.accepted, []);
});

test('opaque result and file keys never alias inherited object properties', async () => {
  const f = fixture();
  const stored = { ...canonical, id: 'constructor', artifacts: [{ ...artifact, key: '__proto__' }, canonical.artifacts[1]] };
  f.cache.set(historyKey(plateId, canonical.wellId), { mode: 'STORED', missing: false, results: [stored] });
  const opaqueTarget = { ...target, resultId: stored.id };
  assert.deepEqual(await f.commands.execute({ ...restore, target: opaqueTarget }), { ok: true, changed: true });
  assert.equal(Object.prototype.hasOwnProperty.call(f.state().restores, '__proto__'), true);
  assert.equal(f.state().restores.__proto__.state, 'in_progress');
  assert.equal((await f.commands.execute({ type: 'query.repair', target: opaqueTarget })).ok, true);
  assert.equal(f.state().athena.constructor.state, 'running');
  f.scenario({ role: 'viewer' });
  assert.equal(f.state().athena.constructor.completion.at, 3400);
  assert.equal(Object.prototype.state, undefined);
});

test('malformed direct calls return a refusal without touching state or clipboard', async () => {
  const f = fixture();
  const initial = f.state();
  for (const command of [null, undefined, {}, { type: 'query.repair' }, { ...restore, target: null }, { ...restore, target: { ...target, wellId: 3 } }, { ...restore, target: { ...target, resultId: '' } }, { ...restore, artifactKind: 'constructor' }]) {
    assert.equal(f.commands.preview(command).kind, 'invalid');
    assert.equal((await f.commands.execute(command)).kind, 'invalid');
  }
  assert.equal(resolvePlateResult(null, plateId, f.examples, f.cache), undefined);
  assert.equal(f.state(), initial);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.accepted, []);
});

test('copy checks read permission at invocation while write-protected environments remain readable', async () => {
  const f = fixture();
  const command = { type: 'artifact.copyUri', target, artifactKind: 'bam' };
  f.scenario({ role: 'viewer', environment: 'val' });
  assert.equal((await f.commands.execute(command)).ok, true);
  assert.deepEqual(f.copied, [`s3://synthetic-streams/${artifact.key}`]);
  assert.equal(f.policy[0].action, 'resource.read');
  assert.equal(f.policy[0].resource, 'bam_cram');
  assert.equal(f.policy[0].geography, 'us_east');
  f.scenario({ principalId: 'prin_tanaka', role: 'analyst', environment: 'res' });
  assert.equal((await f.commands.execute(command)).kind, 'clearance');
  assert.equal(f.writes(), 1);
});

test('clipboard failure reports an unavailable effect and leaves accepted storage unchanged', async () => {
  const f = fixture({ clipboardError: true });
  const initial = f.state();
  assert.equal((await f.commands.execute({ type: 'artifact.copyUri', target, artifactKind: 'bam' })).kind, 'unavailable');
  assert.equal(f.state(), initial);
  assert.deepEqual(f.copied, []);
  assert.deepEqual(f.accepted, []);
});

test('canonical ownership can withhold a formerly active result or refuse unknown ownership', async () => {
  for (const [owner, kind] of [[() => ({ geography: 'eu_west', consent: 'pending' }), 'consent'], [() => undefined, 'unavailable']]) {
    const f = fixture({ owner });
    const before = f.state();
    assert.equal((await f.commands.execute(restore)).kind, kind);
    assert.equal(f.state(), before);
    assert.deepEqual(f.accepted, []);
  }
});

test('canonical record classification refuses raw timeline commands before any effect', async () => {
  const f = fixture({
    owner: result => ({ geography: 'us_east', consent: result.consent, dataClass: 'phi' }),
    checkPermission: (scenario, request) => {
      const derived = deriveScenario(permissionCatalog, { version: 1, principalId: scenario.principalId, roleId: scenario.role, environment: scenario.environment, grantChanges: [] });
      assert.equal(derived.ok, true);
      return decideScopedPermission(derived.scope, request);
    },
  });
  const initial = f.state();
  for (const command of [restore, { type: 'query.repair', target }, { type: 'artifact.copyUri', target, artifactKind: 'bam' }]) {
    assert.equal(f.commands.preview(command).kind, 'clearance');
    assert.equal((await f.commands.execute({ ...command, dataClass: 'de_identified' })).kind, 'clearance', 'caller metadata cannot replace the canonical classification');
  }
  assert.ok(f.policy.every(request => request.dataClass === 'phi'));
  assert.equal(f.state(), initial);
  assert.deepEqual(f.accepted, []);
  assert.equal(f.writes(), 0);
});
