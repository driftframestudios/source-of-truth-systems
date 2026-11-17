// Explicit installed-engine proof; the ordinary unit suite stays offline.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { verifyBetterleaksInstall } from "../../scripts/security/install-betterleaks.mjs";
import {
  executeSecretScan,
  runSyntheticCanary,
} from "../../scripts/security/scan-secret-material.mjs";
const configPath = fileURLToPath(
  new URL("../../.betterleaks.toml", import.meta.url),
);

test("installed engine detects a fresh canary and applies only exact fixture exceptions", async (t) => {
  const { binaryPath } = await verifyBetterleaksInstall();
  assert.deepEqual(await runSyntheticCanary({ binaryPath, configPath }), {
    detected: true,
    redacted: true,
    rule: "github-pat",
  });
  const root = await mkdtemp(join(tmpdir(), "publication-engine-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scan = async () =>
    executeSecretScan({
      binaryPath,
      configPath,
      cwd: root,
      scannerArguments: ["dir", "."],
      scope: "fixture boundary",
    });
  await mkdir(join(root, "tests"));
  const allowed = join(root, "tests/database-proof.test.mjs");
  const assignment = (value) => JSON.stringify({ DB_PASSWORD: value });
  const fixtureValue = ["test", "only"].join("-");
  await writeFile(allowed, assignment(fixtureValue));
  assert.equal((await scan()).findings.length, 0);
  await writeFile(join(root, "elsewhere.mjs"), assignment(fixtureValue));
  assert.equal((await scan()).findings.length, 1);
  await rm(join(root, "elsewhere.mjs"));
  await writeFile(
    allowed,
    assignment(`non-issued-${randomBytes(16).toString("hex")}`),
  );
  assert.equal((await scan()).findings.length, 1);
});
