import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/corridor/corridorProjection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { projectCorridor } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const lanes = [{ id: 'lab' }, { id: 'review' }];
const cards = [
  { id: 'intake', laneId: 'lab', kind: 'process' },
  { id: 'ready', laneId: 'lab', kind: 'state_major' },
  { id: 'approved', laneId: 'review', kind: 'state_major' },
];
const arrows = [
  { id: 'processing', fromCardId: 'intake', toCardId: 'ready' },
  { id: 'reviewing', fromCardId: 'ready', toCardId: 'approved' },
];

test('card filtering removes its relationships and clearing restores their order', () => {
  const filtered = projectCorridor(lanes, cards.filter((card) => card.kind !== 'process'), arrows);
  assert.deepEqual(filtered.connections.map(({ arrow }) => arrow.id), ['reviewing']);
  assert.equal(filtered.connections[0].from, cards[1]);
  assert.equal(filtered.connections[0].to, cards[2]);
  assert.deepEqual(projectCorridor(lanes, cards, arrows).connections.map(({ arrow }) => arrow.id), ['processing', 'reviewing']);
});

test('hidden lanes remove their cards and cross-lane arrows together', () => {
  const projection = projectCorridor([lanes[0]], cards, arrows);
  assert.deepEqual(projection.cards.map((card) => card.id), ['intake', 'ready']);
  assert.deepEqual(projection.connections.map(({ arrow }) => arrow.id), ['processing']);
});

test('a search with one isolated match has a card and no dangling connections', () => {
  const projection = projectCorridor(lanes, [cards[2]], arrows);
  assert.deepEqual(projection.cards, [cards[2]]);
  assert.deepEqual(projection.connections, []);
  assert.deepEqual(projectCorridor([], cards, arrows), { cards: [], connections: [] });
});
