import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source = await readFile(new URL('../src/app/components/mapProjection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { projectMapGraph } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('map paths and label anchors preserve geometry while records and neighbors change', () => {
  const nodes = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 400, y: 100 }, { id: 'c', x: 250, y: 300 }];
  const edges = [{ id: 'ab', from: 'a', to: 'b', fromOffsetX: 10 }, { id: 'bc', from: 'b', to: 'c' }, { id: 'missing', from: 'c', to: 'gone' }];
  const view = projectMapGraph(nodes, edges);
  assert.deepEqual(view.connections.map(({ path, lx, ly }) => ({ path, lx, ly })), [
    { path: 'M 190 100 Q 255 65 320 100', lx: 255, ly: 56 },
    { path: 'M 400 129 C 400 200, 250 200, 250 271', lx: 325, ly: 200 },
  ]);
  assert.deepEqual([...view.neighbors.get('b')], ['a', 'c']);
  assert.deepEqual([...view.neighbors.get('c')], ['b']);
  const moved = projectMapGraph(nodes.map(n => n.id === 'c' ? { ...n, y: 400 } : n), edges);
  assert.equal(moved.connections[1].path, 'M 400 129 C 400 250, 250 250, 250 371');
  assert.equal(projectMapGraph(nodes.slice(0, 1), edges).connections.length, 0);
});

test('map endpoint preparation reads each node identity once for small and larger graphs', () => {
  for (const count of [20, 2000]) {
    let reads = 0;
    const nodes = Array.from({ length: count }, (_, i) => ({ get id() { reads++; return `n${i}`; }, x: i * 200, y: i % 2 * 100 }));
    const edges = Array.from({ length: count - 1 }, (_, i) => ({ id: `e${i}`, from: `n${i}`, to: `n${i + 1}` }));
    const view = projectMapGraph(nodes, edges);
    assert.equal(reads, count);
    assert.equal(view.connections.length, count - 1);
    for (let i = 1; i < count - 1; i++) assert.equal(view.neighbors.get(`n${i}`).size, 2);
    assert.equal(reads, count, 'hover adjacency lookup consumes the prepared index');
  }
});
