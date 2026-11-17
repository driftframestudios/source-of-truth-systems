import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

test('the CLI guard rejects a flattened 3D carrier and permits a leaf-only effect', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sot-3d-canary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'));
  await cp(new URL('../scripts/check-3d-flattening.mjs', import.meta.url), join(root, 'scripts/check.mjs'));
  const owners = ['views/LanesView', 'corridor/CorridorScene', 'plate/PlateScene3D', 'plate/ResultStack', 'mobile/MobileCorridor'];
  for (const owner of owners) {
    const file = join(root, 'src/app/components', `${owner}.tsx`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '');
  }
  const carrier = join(root, 'src/app/components/plate/ResultStack.tsx');
  const run = () => spawnSync(process.execPath, ['scripts/check.mjs'], { cwd: root, encoding: 'utf8' });
  await writeFile(carrier, `<div style={{ transformStyle: 'preserve-3d' }}><i style={{ opacity: 0.5 }} /></div>`);
  assert.equal(run().status, 0);
  await writeFile(carrier, `<div style={{ transformStyle: 'preserve-3d', opacity: 0.5 }} />`);
  const flattened = run();
  assert.equal(flattened.status, 1);
  assert.match(flattened.stderr, /flattens its 3D children/);
  await writeFile(carrier, `<i style={{ mixBlendMode: 'screen' }} />`);
  assert.equal(run().status, 1);
});
