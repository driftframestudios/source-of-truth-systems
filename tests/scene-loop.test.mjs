import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/sceneLoop.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { startSceneLoop } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a stopped scene cannot update or reschedule, and resume begins a fresh elapsed interval', () => {
  let time = 100;
  let id = 0;
  const requests = new Map();
  const scheduler = {
    now: () => time,
    request: (callback) => { requests.set(++id, callback); return id; },
    cancel: (key) => requests.delete(key),
  };
  const elapsed = [];
  const stop = startSceneLoop((dt) => elapsed.push(dt), scheduler);
  const callback = requests.get(1);
  requests.delete(1);
  callback(116);
  assert.deepEqual(elapsed, [16]);
  assert.equal(requests.size, 1);
  stop();
  callback(120); // an already-delivered callback remains harmless after cleanup
  assert.deepEqual(elapsed, [16]);
  assert.equal(requests.size, 0);
  time = 10000;
  const stopAgain = startSceneLoop((dt) => elapsed.push(dt), scheduler);
  const [key, next] = [...requests][0];
  requests.delete(key);
  next(10016);
  assert.deepEqual(elapsed, [16, 16], 'hidden time must not become a camera jump');
  stopAgain();
  assert.equal(requests.size, 0);
});
