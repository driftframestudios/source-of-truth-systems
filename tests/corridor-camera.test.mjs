import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/corridor/corridorCamera.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { orbitCorridor, displayCorridorYaw, nearestCorridorYaw, CORRIDOR_PRESETS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('orbit crosses yaw and horizon boundaries without a discontinuous turn', () => {
  const crossed = orbitCorridor(89, 179, 10, -5);
  assert.deepEqual(crossed, { pitch: 91, yaw: 183 });
  assert.deepEqual(orbitCorridor(crossed.pitch, crossed.yaw, 5, -5), { pitch: 93, yaw: 185 });
  assert.equal(displayCorridorYaw(crossed.yaw), -177);
  assert.equal(nearestCorridorYaw(-179, 179), 181);
  assert.equal(nearestCorridorYaw(179, -179), -181);
});

test('pointer pitch and every preset stay in the surface-focused camera range', () => {
  assert.equal(orbitCorridor(54, 0, 0, -1000).pitch, 100);
  assert.equal(orbitCorridor(54, 0, 0, 1000).pitch, 0);
  assert.deepEqual(CORRIDOR_PRESETS.map(({ label, pitch }) => [label, pitch]), [
    ['Top', 0], ['Isometric', 56], ['Side', 90],
  ]);
});
