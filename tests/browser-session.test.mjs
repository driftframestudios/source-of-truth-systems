import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/services/browserSession.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createBrowserSession, createSessionState } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('feature state initializes on demand and remains in its application instance', () => {
  let calls = 0;
  const feature = { create: () => { calls++; return createSessionState({ order: 'in_progress' }); } };
  const session = createBrowserSession();
  assert.equal(calls, 0);
  const firstView = session.get(feature);
  firstView.update(() => ({ order: 'on_hold' }));
  const receivingView = session.get(feature);
  assert.equal(receivingView, firstView);
  assert.equal(receivingView.getSnapshot().order, 'on_hold');
  assert.equal(calls, 1);
  const newSession = createBrowserSession();
  assert.equal(newSession.get(feature).getSnapshot().order, 'in_progress');
  assert.equal(calls, 2);
});

test('only accepted snapshot changes notify current receivers', () => {
  const initial = Object.freeze({ state: 'pending' });
  const state = createSessionState(initial);
  const seen = [];
  const stop = state.subscribe(() => seen.push(state.getSnapshot()));
  assert.equal(state.getSnapshot(), initial);
  assert.equal(state.update((current) => current), false);
  assert.deepEqual(seen, []);
  const accepted = Object.freeze({ state: 'resolved' });
  assert.equal(state.update(() => accepted), true);
  assert.equal(state.getSnapshot(), accepted);
  assert.deepEqual(seen, [accepted]);
  stop();
  state.update(() => ({ state: 'pending' }));
  assert.deepEqual(seen, [accepted]);
  assert.equal(initial.state, 'pending');
});
