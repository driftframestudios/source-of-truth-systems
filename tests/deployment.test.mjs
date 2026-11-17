import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, runningServer } from './server-fixture.mjs';

test('production entry serves built HTML and JavaScript from any working directory', async (t) => {
  const base = await runningServer(t);
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
  assert.equal(html.headers.get('cache-control'), 'no-cache');
  assert.match(html.headers.get('content-security-policy'), /script-src 'self'; script-src-attr 'none'/);
  assert.doesNotMatch(html.headers.get('content-security-policy'), /frame-ancestors/);
  assert.match(await html.text(), /Deployment fixture/);
  const asset = await fetch(`${base}/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(asset.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await asset.text(), 'export const ready = true;');
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('missing assets, source files, directory listings, and symlinks stay outside the served app', async (t) => {
  const base = await runningServer(t);
  for (const path of ['/assets/missing.js', '/package.json', '/scripts/serve.mjs', '/server/graphql/schema.graphql', '/build/server/example-data.mjs', '/assets/', '/private.json']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 400);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
});

test('startup fails clearly when the build is absent', async (t) => {
  const process = await fixture(t, { built: false });
  const [code] = await process.exited;
  assert.equal(code, 1);
  assert.match(process.output(), /Production build is missing/);
});

test('startup rejects a malformed platform port', async (t) => {
  const process = await fixture(t, { port: '8080oops' });
  const [code] = await process.exited;
  assert.equal(code, 1);
  assert.match(process.output(), /PORT must be an integer/);
});


test('startup fails clearly when the private server data build is absent', async (t) => {
  const process = await fixture(t, { serverBuilt: false });
  const [code] = await process.exited;
  assert.equal(code, 1);
  assert.match(process.output(), /Server data build is missing or invalid/);
});
