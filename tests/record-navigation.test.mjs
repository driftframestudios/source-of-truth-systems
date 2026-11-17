import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/services/recordNavigation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
const { resolveRecordTarget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const records = { sources: [{ id: 'source-first' }, { id: 'shared-id' }], artifacts: [{ id: 'artifact-first' }], instructions: [], comparisons: [], decisions: [] };

test('navigation resolves the exact requested identity inside its destination', () => {
  assert.deepEqual(resolveRecordTarget({ section: 'sources', entityId: 'shared-id' }, records), {
    status: 'found', target: { section: 'sources', entityId: 'shared-id' },
  });
  assert.deepEqual(resolveRecordTarget({ section: 'artifacts', entityId: 'shared-id' }, records), {
    status: 'missing', target: { section: 'artifacts', entityId: 'shared-id' },
  });
});

test('missing identity and unsupported destination cannot fall back to a first record', () => {
  assert.equal(resolveRecordTarget({ section: 'sources', entityId: 'missing' }, records).status, 'missing');
  assert.equal(resolveRecordTarget({ section: 'sources', entityId: '' }, records).status, 'missing');
  assert.deepEqual(resolveRecordTarget({ section: '__proto__', entityId: 'shared-id' }, records), { status: 'unsupported' });
});
