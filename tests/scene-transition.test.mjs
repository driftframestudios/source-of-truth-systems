import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/plate/sceneTransition.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createSceneTransition } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture() {
  let id = 0;
  const delays = new Map();
  const frames = new Map();
  const transition = createSceneTransition({
    delay: (callback) => { delays.set(++id, callback); return id; },
    clearDelay: (key) => delays.delete(key),
    frame: (callback) => { frames.set(++id, callback); return id; },
    clearFrame: (key) => frames.delete(key),
  });
  return { transition, delays, frames };
}

test('unmount during the release delay settles the wait without starting the next animation', async () => {
  const { transition, delays } = fixture();
  const run = transition.begin();
  let animated = false;
  const release = (async () => {
    await transition.delay(200);
    if (transition.current(run)) animated = true;
  })();
  assert.equal(delays.size, 1);
  transition.cancel();
  await release;
  assert.equal(delays.size, 0);
  assert.equal(animated, false);
});

test('reversal cancels the prior camera and extrusion frame while the new run completes', () => {
  const { transition, frames } = fixture();
  const first = transition.begin();
  let stopped = 0;
  let extruded = false;
  transition.own(() => { stopped++; });
  transition.frame(() => { extruded = true; });
  const second = transition.begin();
  assert.equal(stopped, 1);
  assert.equal(frames.size, 0);
  assert.equal(extruded, false);
  assert.equal(transition.current(first), false);
  assert.equal(transition.current(second), true);
  const finished = transition.own(() => { stopped++; });
  finished();
  transition.cancel();
  assert.equal(stopped, 1, 'a completed camera animation releases its cancellation handle');
});
