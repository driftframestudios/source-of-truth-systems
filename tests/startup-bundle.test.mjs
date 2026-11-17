import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

// Observe Vite's actual production graph: source-level dynamic imports alone
// cannot detect a desktop module pulled back in through a shared dependency.
const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
const desktop = 'src/app/DesktopWorkspace.tsx';
const plate = 'src/app/components/mobile/MobilePlate.tsx';

function staticClosure(entry, visited = new Set()) {
  if (visited.has(entry)) return visited;
  assert.ok(manifest[entry], `Missing emitted module: ${entry}`);
  visited.add(entry);
  for (const dependency of manifest[entry].imports ?? []) staticClosure(dependency, visited);
  return visited;
}

test('initial mobile delivery excludes the desktop workspace and unopened plate', async (t) => {
  const initial = staticClosure('index.html');
  for (const deferred of [desktop, plate]) {
    assert.equal(manifest[deferred]?.isDynamicEntry, true, `${deferred} remains independently loadable`);
    assert.equal(initial.has(deferred), false, `${deferred} must stay outside the initial graph`);
  }
  let bytes = 0;
  for (const key of initial) bytes += (await stat(new URL(manifest[key].file, dist))).size;
  // Leave room for ordinary feature edits while detecting desktop code hoisted
  // into an entry/shared chunk without changing the dynamic entry boundaries.
  assert.ok(bytes < 450_000, `Initial JavaScript exceeds the 450 kB budget: ${bytes} bytes`);
  t.diagnostic(`Initial JavaScript: ${bytes} bytes across ${initial.size} files (uncompressed).`);
});

test('first plate load stays independent of desktop and every declared asset exists', async () => {
  assert.equal(staticClosure(plate).has(desktop), false);
  for (const entry of Object.values(manifest)) {
    for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
      assert.ok((await stat(new URL(file, dist))).isFile(), `Missing production asset: ${file}`);
    }
  }
});
