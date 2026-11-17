import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Use the installed compiler so this focused test runs on the declared Node 22
// toolchain without an additional TypeScript test runner or runtime flag.
const source = await readFile(new URL('../src/app/components/mobile/corridorGesture.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { createCorridorGesture } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('a short tap remains a card click; a drag crosses the threshold once', () => {
  const gesture = createCorridorGesture();
  gesture.begin(1, { x: 40, y: 40 });
  assert.equal(gesture.move(1, { x: 43, y: 42 }), null);
  assert.equal(gesture.end(1), false);
  gesture.begin(2, { x: 40, y: 40 });
  assert.deepEqual(gesture.move(2, { x: 46, y: 40 }), { dx: 6, dy: 0, zoomRatio: 1, pinch: false });
  assert.deepEqual(gesture.move(2, { x: 47, y: 40 }), { dx: 1, dy: 0, zoomRatio: 1, pinch: false });
  assert.equal(gesture.end(2), true);
});

test('a two-finger spread doubles distance and moves the midpoint by ten pixels', () => {
  const gesture = createCorridorGesture();
  gesture.begin(1, { x: 10, y: 40 });
  gesture.begin(2, { x: 30, y: 40 });
  assert.deepEqual(gesture.move(2, { x: 50, y: 40 }), { dx: 10, dy: 0, zoomRatio: 2, pinch: true });
  assert.equal(gesture.end(2), true);
  assert.deepEqual(gesture.move(1, { x: 16, y: 45 }), { dx: 6, dy: 5, zoomRatio: 1, pinch: false });
});

test('moving both fingers equally pans without a net change in zoom', () => {
  const gesture = createCorridorGesture();
  gesture.begin(1, { x: 10, y: 40 });
  gesture.begin(2, { x: 30, y: 40 });
  const first = gesture.move(1, { x: 20, y: 50 });
  const second = gesture.move(2, { x: 40, y: 50 });
  assert.equal(first.dx + second.dx, 10);
  assert.equal(first.dy + second.dy, 10);
  assert.ok(Math.abs(first.zoomRatio * second.zoomRatio - 1) < 1e-12);
});

test('cancelled or uncaptured contacts cannot participate in the next gesture', () => {
  const gesture = createCorridorGesture();
  gesture.begin(1, { x: 0, y: 0 });
  assert.equal(gesture.end(1), false); // pointer leaves before capture
  assert.equal(gesture.move(1, { x: 90, y: 0 }), null);
  gesture.begin(2, { x: 50, y: 50 });
  gesture.begin(3, { x: 100, y: 50 });
  assert.equal(gesture.end(3), true); // pointercancel or lostpointercapture
  assert.equal(gesture.end(3), false); // duplicate lifecycle event is harmless
  assert.deepEqual(gesture.move(2, { x: 55, y: 50 }), { dx: 5, dy: 0, zoomRatio: 1, pinch: false });
  assert.deepEqual(gesture.reset(), [2]); // blur, lane change, or reset
  assert.equal(gesture.move(2, { x: 70, y: 50 }), null);
  gesture.begin(4, { x: 80, y: 80 });
  assert.equal(gesture.move(4, { x: 82, y: 80 }), null);
  assert.equal(gesture.end(4), false);
});

test('an extra contact cannot take over the active pair', () => {
  const gesture = createCorridorGesture();
  gesture.begin(1, { x: 0, y: 0 });
  gesture.begin(2, { x: 20, y: 0 });
  gesture.begin(3, { x: 200, y: 0 });
  assert.equal(gesture.move(3, { x: 300, y: 0 }), null);
  assert.deepEqual(gesture.move(2, { x: 40, y: 0 }), { dx: 10, dy: 0, zoomRatio: 2, pinch: true });
});
