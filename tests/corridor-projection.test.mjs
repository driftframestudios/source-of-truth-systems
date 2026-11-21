import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/components/corridor/corridorProjection.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { projectCorridor, projectCorridorGeometry } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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


test('lane geometry preserves order, endpoints and records when lanes move or hide', () => {
  const positioned = cards.map((card, index) => ({ ...card, position: index / 2 }));
  const flags = [{ id: 'gate', laneId: 'review' }];
  const labels = [{ id: 'label', laneId: 'lab' }];
  const first = projectCorridorGeometry(lanes, positioned, arrows, flags, labels);
  assert.deepEqual(first.rows.map(row => row.yOff), [-78, 78]);
  assert.equal(first.connections[1].path, 'M 0 -98 Q 792 -170.4 1320 58');
  assert.deepEqual(first.rows[0].surfaceLabels, labels);
  assert.deepEqual(first.rows[1].flags, flags);
  const moved = projectCorridorGeometry([...lanes].reverse(), positioned, arrows, flags, labels);
  assert.equal(moved.connections[1].path, 'M 0 58 Q 792 -170.4 1320 -98');
  const hidden = projectCorridorGeometry([lanes[0]], positioned, arrows, flags, labels);
  assert.equal(hidden.rows[0].yOff, 0);
  assert.deepEqual(hidden.rows[0].flags, []);
  assert.equal(hidden.connections.length, 1);
});

test('larger corridor preparation uses bounded linear record lookups', () => {
  for (const count of [11, 110]) {
    let reads = 0;
    const largeLanes = Array.from({ length: count }, (_, i) => ({ get id() { reads++; return `lane${i}`; } }));
    const largeCards = Array.from({ length: count * 10 }, (_, i) => ({ id: `card${i}`, get laneId() { reads++; return `lane${i % count}`; }, position: .5 }));
    const links = largeCards.slice(1).map((card, i) => ({ id: `link${i}`, fromCardId: largeCards[i].id, toCardId: card.id }));
    const result = projectCorridorGeometry(largeLanes, largeCards, links, [], []);
    assert.equal(result.connections.length, links.length);
    assert.ok(reads < count * 50, `${count} lanes: ${reads} identity reads`);
  }
});
