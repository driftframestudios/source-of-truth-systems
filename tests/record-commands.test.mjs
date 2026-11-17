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
const types = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', { '../types/access': types });
const scopeModule = await moduleUrl('../src/app/services/permissionScope.ts', { './accessService': access });
const { decidePermission } = await import(await moduleUrl('../src/app/services/permissionPolicy.ts', { '../types/access': types, './accessService': access, './permissionScope': scopeModule, '../../../shared/permission-scope.mjs': policyKernel }));
const records = await moduleUrl('../src/app/services/recordSession.ts');
const { createRecordSession } = await import(records);
const command = await moduleUrl('../src/app/services/command.ts');
const { createRecordCommands } = await import(await moduleUrl('../src/app/services/recordCommands.ts', { './recordSession': records, './command': command, '../../../shared/permission-scope.mjs': policyKernel }));

function fixture({ geographyCode = 'USE' } = {}) {
  let state = createRecordSession({
    specimens: [
      { id: 'active', geographyCode, consent: 'active', sampleState: 'received', orderState: 'in_progress', reviewState: 'in_review' },
      { id: 'held', geographyCode: 'EUW', consent: 'rescinded', sampleState: 'received', orderState: 'in_progress', reviewState: 'in_review' },
    ],
    biomarkers: [
      { id: 'marker', specimenId: 'active', reviewState: 'in_review' },
      { id: 'held-marker', specimenId: 'held', reviewState: 'in_review' },
      { id: 'orphan', specimenId: 'missing', reviewState: 'in_review' },
    ],
  });
  let policy = { principalId: 'prin_self', role: 'lab_operator', environment: 'res' };
  let commits = 0;
  const commands = createRecordCommands({
    getState: () => state,
    commit: next => { state = next; commits++; },
    checkPermission: request => decidePermission({ ...policy, ...request }),
  });
  return { commands, state: () => state, commits: () => commits, policy: next => { policy = { ...policy, ...next }; } };
}
const order = { type: 'specimen.order', id: 'active', event: 'hold' };
const review = { type: 'biomarker.review', id: 'marker', event: 'approve' };

test('direct accepted commands change only their target and reject stale transitions', () => {
  const f = fixture();
  const before = f.state();
  assert.equal(f.commands.execute(order).ok, true);
  assert.equal(f.state().specimens.byId.active.orderState, 'on_hold');
  assert.equal(f.state().specimens.byId.active.sampleState, 'received');
  assert.equal(f.state().specimens.byId.held, before.specimens.byId.held);
  assert.equal(f.state().biomarkers, before.biomarkers);
  assert.equal(f.commands.execute(order).kind, 'transition');
  assert.equal(f.commits(), 1);
});

test('preview grants cannot survive a later role or environment change', () => {
  const f = fixture();
  const before = f.state();
  const captured = f.commands.execute;
  assert.equal(f.commands.check(order).ok, true);
  f.policy({ role: 'viewer' });
  assert.equal(captured(order).kind, 'role');
  f.policy({ role: 'lab_operator', environment: 'val' });
  assert.equal(captured(order).kind, 'environment');
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});

test('clinical approval uses the clinical capability and canonical clearance, independently of sample work', () => {
  const f = fixture();
  f.policy({ role: 'admin' });
  assert.equal(f.commands.execute(review).kind, 'clearance');
  f.policy({ principalId: 'prin_okafor', role: 'lab_operator', environment: 'stg' });
  assert.equal(f.commands.execute(review).kind, 'role');
  f.policy({ role: 'reviewer' });
  assert.equal(f.commands.execute(review).ok, true);
  assert.equal(f.state().biomarkers.byId.marker.reviewState, 'approved');
  assert.equal(f.commands.execute({ type: 'specimen.sample', id: 'active', event: 'advance' }).kind, 'role');
  assert.equal(f.commits(), 1);
});

test('canonical consent and ownership defeat forged caller metadata and unknown records', () => {
  const f = fixture();
  f.policy({ principalId: 'prin_okafor', role: 'admin', environment: 'stg' });
  const before = f.state();
  assert.equal(f.commands.execute({ ...review, id: 'held-marker', consent: 'active', specimenId: 'active' }).kind, 'consent');
  assert.equal(f.commands.execute({ ...review, id: 'orphan' }).kind, 'missing');
  for (const invalid of [null, { ...order, type: 'constructor' }, { ...order, event: 'toString' }, { ...order, id: 'toString' }]) {
    assert.equal(f.commands.execute(invalid).ok, false);
  }
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});

test('a record with unrecognized geography leaves the workflow unchanged', () => {
  const f = fixture({ geographyCode: 'unmapped' });
  const before = f.state();
  assert.equal(f.commands.execute(order).kind, 'unavailable');
  assert.equal(f.state(), before);
  assert.equal(f.commits(), 0);
});
