import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

test('the actual formatter retains valid type members and is stable on a second pass', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sot-format-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'example.ts');
  await writeFile(file, 'type Example = { label: string; items: ReadonlyArray<string> };\n');
  const format = () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url)), '--write', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  format();
  const first = await readFile(file, 'utf8');
  const source = ts.createSourceFile('example.ts', first, ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, 'Formatted source remains valid TypeScript');
  assert.deepEqual(source.statements[0].type.members.map(member => member.name.getText(source)), ['label', 'items']);
  format();
  assert.equal(await readFile(file, 'utf8'), first);
});
