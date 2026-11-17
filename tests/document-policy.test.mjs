import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { documentPolicy } from "../server/security/document-policy.mjs";

test("production CSP hashes the exact bootstrap and retains required visual resource origins", async () => {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  const body = html.match(
    /<script id="initial-load-bootstrap">([\s\S]*?)<\/script>/,
  )[1];
  const hash = createHash("sha256").update(body).digest("base64");
  const policy = documentPolicy(html);
  assert.ok(policy.includes(`script-src 'self' 'sha256-${hash}'`));
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(
    policy,
    /style-src 'self' 'unsafe-inline' https:\/\/fonts.googleapis.com/,
  );
  assert.match(policy, /font-src 'self' https:\/\/fonts.gstatic.com/);
  assert.match(
    policy,
    /object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'/,
  );
  assert.doesNotMatch(policy, /unsafe-eval|unsafe-hashes|frame-ancestors/);
  assert.doesNotMatch(html, /\sonclick=/);
});

test("unreviewed or duplicate inline scripts stop startup instead of expanding script permission", () => {
  for (const html of [
    "<script>window.unreviewed = true;</script>",
    '<script data-id="initial-load-bootstrap">window.unreviewed = true;</script>',
    '<script data-src="app.js">window.unreviewed = true;</script>',
    '<script id="initial-load-bootstrap">one()</script><script id="initial-load-bootstrap">two()</script>',
  ])
    assert.throws(() => documentPolicy(html), /unreviewed inline script/);
  assert.doesNotThrow(() =>
    documentPolicy('<script type="module" src="/assets/app.js"></script>'),
  );
});
