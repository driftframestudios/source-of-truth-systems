import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/sceneDrag.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createSceneDrag } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('the active pointer owns the camera; a second contact cannot move or release it', () => {
  const drag = createSceneDrag(4);
  assert.equal(drag.begin(1, 20, 20, 'pan'), true);
  assert.equal(drag.begin(2, 20, 20, 'orbit'), false);
  assert.equal(drag.move(2, 100, 100), null);
  assert.equal(drag.end(2), null);
  assert.equal(drag.move(1, 22, 21), null);
  assert.deepEqual(drag.move(1, 25, 23), { dx: 5, dy: 3, mode: 'pan' });
  assert.equal(drag.end(1).moved, true);
  assert.equal(drag.move(1, 90, 90), null);
});

test('interruption clears the drag and the next short interaction stays a click', () => {
  const drag = createSceneDrag(3);
  drag.begin(8, 0, 0, 'orbit');
  drag.move(8, 8, 0);
  assert.equal(drag.reset().id, 8);
  assert.equal(drag.reset(), null);
  assert.equal(drag.isDragging(), false);
  assert.equal(drag.move(8, 100, 100), null);
  drag.begin(9, 30, 30, 'orbit');
  assert.equal(drag.move(9, 31, 31), null);
  assert.equal(drag.end(9).moved, false);
});
