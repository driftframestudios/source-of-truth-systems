import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Compile the small pure dependency graph with the repository's existing compiler.
async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  for (const [specifier, url] of Object.entries(imports)) outputText = outputText.replaceAll(`'${specifier}'`, `'${url}'`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const { createPlateOverlayState, plateOverlayReducer, applyResultRestores } = await import(await moduleUrl('../src/app/components/plate/plateOverlayState.ts'));
const accessTypes = await moduleUrl('../src/app/types/access.ts');
const access = await moduleUrl('../src/app/services/accessService.ts', { '../types/access': accessTypes });
const results = await moduleUrl('../src/app/data/wellResults.ts');
const { resolveArtifact, stackPullPlan } = await import(await moduleUrl('../src/app/services/dataAvailability.ts', { '../types/access': accessTypes, './accessService': access, '../data/wellResults': results }));

const now = '2026-09-28T09:00:00Z';
const option = { tier: 'standard', label: 'Standard', minHours: 3, maxHours: 5, usdPerGb: 0.01 };
const artifact = Object.freeze({ kind: 'bam', key: 'bam/original.bam', createdAt: '2026-05-31', ruleId: 'lc-bam-v3', sizeBytes: 1e9 });
const original = Object.freeze({ id: 'original', consent: 'active', status: 'reportable', artifacts: Object.freeze([artifact]) });
const alias = Object.freeze({ id: 'reanalysis', consent: 'active', status: 'reportable', artifacts: Object.freeze([{ ...artifact, reusedFrom: original.id }]) });
const other = Object.freeze({ id: 'other', consent: 'active', status: 'reportable', artifacts: Object.freeze([{ ...artifact, key: 'bam/other.bam', sizeBytes: 2e9 }]) });
const request = (state, file = artifact) => plateOverlayReducer(state, { type: 'restore.request', artifact: file, option, now });

test('one physical-file request appears through both result aliases and counts the bytes once', () => {
  const initial = createPlateOverlayState();
  const state = request(initial, alias.artifacts[0]);
  const projected = [original, alias, other].map((result) => applyResultRestores(result, state.restores));
  assert.equal(projected[0].artifacts[0].restore, projected[1].artifacts[0].restore);
  assert.equal(resolveArtifact(projected[0].artifacts[0], projected[0]).state, 'restoring');
  assert.equal(resolveArtifact(projected[1].artifacts[0], projected[1]).state, 'restoring');
  assert.equal(projected[2], other);
  const plan = stackPullPlan(projected);
  assert.equal(plan.files, 2);
  assert.equal(plan.totalBytes, 3e9);
  assert.equal(plan.restoring, 1);
  assert.equal(request(state), state);
  assert.equal(original.artifacts[0].restore, undefined);
  assert.deepEqual(initial.restores, {});
});

test('a shared restored file never overrides the receiving result consent', () => {
  const restores = { [artifact.key]: { state: 'restored', tier: 'standard', requestedAt: now, expiresAt: '2026-10-05' } };
  const held = applyResultRestores({ ...alias, consent: 'pending' }, restores);
  const active = applyResultRestores(original, restores);
  assert.equal(resolveArtifact(held.artifacts[0], held).state, 'held');
  assert.equal(resolveArtifact(active.artifacts[0], active).state, 'restored');
  assert.equal(held.consent, 'pending');
});

test('restore stays pending at the fixed demo clock and repeated requests retain their chosen tier', () => {
  const state = request(createPlateOverlayState());
  assert.deepEqual(state.restores[artifact.key], { generation: 1, state: 'in_progress', tier: 'standard', requestedAt: now, readyAt: '2026-09-28T13:00:00.000Z' });
  const repeated = plateOverlayReducer(state, { type: 'restore.request', artifact, option: { ...option, tier: 'bulk' }, now });
  assert.equal(repeated, state);
  assert.equal(request(createPlateOverlayState(), { ...artifact, key: '' }).restores[''], undefined);
  const fresh = createPlateOverlayState();
  assert.equal(request(fresh, { ...artifact, restore: state.restores[artifact.key] }), fresh);
});

test('Athena repair and rebuild complete once and reject an older generation', () => {
  const initial = createPlateOverlayState();
  const completion = { at: 12_400, wellId: 'A9', label: 'T1', runDate: '2026-09-01' };
  const start = { type: 'athena.start', resultId: original.id, kind: 'repair', completion };
  const running = plateOverlayReducer(initial, start);
  assert.equal(running.athena[original.id].completion, completion);
  assert.equal(plateOverlayReducer(running, start), running);
  const done = plateOverlayReducer(running, { type: 'athena.complete', resultId: original.id, generation: 1 });
  assert.equal(done.athena[original.id].state, 'done');
  assert.equal(plateOverlayReducer(done, start), done);
  assert.equal(plateOverlayReducer(done, { type: 'athena.complete', resultId: original.id, generation: 1 }), done);
  const queued = plateOverlayReducer(done, { type: 'athena.start', resultId: other.id, kind: 'rebuild' });
  assert.equal(queued.athena[other.id].state, 'running');
  assert.equal(queued.athena[other.id].etaLabel, 'restore requested · CTAS queued');
  assert.equal(plateOverlayReducer(queued, { type: 'athena.complete', resultId: other.id, generation: 1 }), queued);
  assert.equal(queued.athena[original.id], done.athena[original.id]);
});


test('explicit completion propagates shared readability and replay retires the old generation', () => {
  const pending = request(createPlateOverlayState());
  const complete = { type: 'restore.complete', key: artifact.key, generation: 1, now };
  const done = plateOverlayReducer(pending, complete);
  for (const result of [original, alias]) {
    const projection = applyResultRestores(result, done.restores);
    assert.equal(resolveArtifact(projection.artifacts[0], projection).state, 'restored');
  }
  assert.equal(done.restores[artifact.key].expiresAt, '2026-10-05');
  const reset = plateOverlayReducer(done, { type: 'restore.replay', key: artifact.key, generation: 1 });
  assert.equal(applyResultRestores(original, reset.restores), original);
  const restarted = request(reset);
  assert.equal(restarted.restores[artifact.key].generation, 2);
  assert.equal(plateOverlayReducer(restarted, complete), restarted);
  assert.equal(plateOverlayReducer(restarted, { type: 'restore.replay', key: artifact.key, generation: 1 }), restarted);
});

test('query replay preserves unrelated tasks and rejects an obsolete completion', () => {
  const start = { type: 'athena.start', resultId: 'query', kind: 'rebuild' };
  const pending = plateOverlayReducer(createPlateOverlayState(), start);
  const complete = { type: 'athena.complete', resultId: 'query', generation: 1 };
  const done = plateOverlayReducer(pending, complete);
  assert.equal(done.athena.query.state, 'done');
  const reset = plateOverlayReducer(done, { type: 'athena.replay', resultId: 'query', generation: 1 });
  const restarted = plateOverlayReducer(reset, start);
  assert.equal(restarted.athena.query.state, 'running');
  assert.equal(plateOverlayReducer(restarted, complete), restarted);
});
