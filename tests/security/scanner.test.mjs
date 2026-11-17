import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  executeSecretScan,
  generateSyntheticCanary,
  runSyntheticCanary,
  renderFindings,
  SecretScanFindingsError,
  materializeGitIndex,
  materializeEntries,
  assertSingleSuppressionSurface,
  resolveArtifactTarget,
  runProcess,
  materializeDirectory,
} from "../../scripts/security/scan-secret-material.mjs";
const temporary = async (t) => {
  const path = await mkdtemp(join(tmpdir(), "publication-test-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
};
const response = (findings, code = 10) => ({
  code,
  stdout: JSON.stringify(findings),
  stderr: "private diagnostics",
});
const finding = (extra = {}) => ({
  RuleID: "github-pat",
  Match: "token=REDACTED",
  Secret: "REDACTED",
  StartLine: 5,
  ...extra,
});

test("fresh canary proves finding exit, parsing and complete masking", async () => {
  const one = generateSyntheticCanary(),
    two = generateSyntheticCanary();
  assert.notEqual(one, two);
  const good = await runSyntheticCanary({
    binaryPath: "unused",
    canary: one,
    processRunner: async (_binary, args, { input }) => {
      assert.ok(input.includes(one));
      assert.ok(args.includes("--validation=false"));
      assert.ok(args.includes("--max-archive-depth=0"));
      return response([finding({ File: one, Commit: one, Fingerprint: one })]);
    },
  });
  assert.deepEqual(good, {
    detected: true,
    redacted: true,
    rule: "github-pat",
  });
  for (const invalid of [
    response([], 0),
    response([finding()], 0),
    response([], 10),
    response([finding({ Secret: one })]),
    { code: 2, stdout: "", stderr: one },
    { code: 0, stdout: "", stderr: "" },
    { code: 0, stdout: "not-json", stderr: "" },
    { code: 0, stdout: "{}", stderr: "" },
  ]) {
    await assert.rejects(
      runSyntheticCanary({
        binaryPath: "unused",
        processRunner: async () => invalid,
      }),
    );
  }
});

test("raw findings and diagnostics cannot enter the published result", async () => {
  const privateText = generateSyntheticCanary();
  const result = await executeSecretScan({
    binaryPath: "unused",
    scannerArguments: [],
    scope: "source",
    processRunner: async () =>
      response([
        finding({
          File: privateText,
          Commit: privateText,
          Fingerprint: privateText,
          Message: privateText,
          Attributes: { value: privateText },
        }),
      ]),
  });
  assert.deepEqual(Object.keys(result.findings[0]).sort(), [
    "commit",
    "line",
    "ordinal",
    "rule",
  ]);
  assert.ok(!JSON.stringify(result).includes(privateText));
  const report = renderFindings(
    new SecretScanFindingsError("source", result.findings),
  );
  assert.ok(!report.includes(privateText));
  assert.deepEqual(JSON.parse(report).rules, { "github-pat": 1 });
});

test("scanner children receive neither ambient secrets nor Git target overrides", async () => {
  const keys = [
    "PUBLICATION_TEST_SECRET",
    "GIT_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG_COUNT",
  ];
  const previous = keys.map((k) => process.env[k]);
  try {
    keys.forEach((k) => (process.env[k] = "private-test-value"));
    const result = await runProcess(process.execPath, [
      "-e",
      `console.log(JSON.stringify(${JSON.stringify(keys)}.map(k => process.env[k] ?? null)))`,
    ]);
    assert.equal(result.code, 0);
    assert.deepEqual(
      JSON.parse(result.stdout),
      keys.map(() => null),
    );
  } finally {
    keys.forEach((k, i) =>
      previous[i] === undefined
        ? delete process.env[k]
        : (process.env[k] = previous[i]),
    );
  }
});

test("index scan reads exact blobs, including unchanged files, rather than working bytes", async (t) => {
  const root = await temporary(t),
    git = (...args) =>
      execFileSync("git", args, {
        cwd: root,
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
        stdio: "pipe",
      });
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  await writeFile(join(root, "unchanged.txt"), "original");
  await writeFile(join(root, "edited.txt"), "first");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "fixture");
  await writeFile(join(root, "edited.txt"), "staged");
  git("add", "edited.txt");
  await writeFile(join(root, "edited.txt"), "working");
  git("update-index", "--skip-worktree", "unchanged.txt");
  const snapshot = await materializeGitIndex(root);
  t.after(() => rm(snapshot, { recursive: true, force: true }));
  assert.equal(await readFile(join(snapshot, "edited.txt"), "utf8"), "staged");
  assert.equal(
    await readFile(join(snapshot, "unchanged.txt"), "utf8"),
    "original",
  );
  await writeFile(join(root, ".gitleaksignore"), "fixture");
  git("add", ".gitleaksignore");
  const ignored = await materializeGitIndex(root);
  t.after(() => rm(ignored, { recursive: true, force: true }));
  await assert.rejects(assertSingleSuppressionSurface(ignored));
});

test("materialized source and artifact selection reject symlinks and path escape", async (t) => {
  const root = await temporary(t),
    outside = await temporary(t);
  await writeFile(join(outside, "private.txt"), "example");
  await symlink(outside, join(root, "linked"));
  await assert.rejects(resolveArtifactTarget("../", root));
  await assert.rejects(resolveArtifactTarget("linked/private.txt", root));
  await assert.rejects(
    materializeEntries(
      [{ mode: "100644", path: "linked/private.txt" }],
      root,
      true,
    ),
  );
  await assert.rejects(
    materializeEntries([{ mode: "120000", path: "link", oid: "unused" }], root),
  );
  await writeFile(join(root, ".BetterLeaksIgnore"), "fixture");
  await assert.rejects(assertSingleSuppressionSurface(root));
});

test("artifact materialization keeps the inspected bytes independent of later builds", async (t) => {
  const root = await temporary(t);
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets", "app.js"), "accepted bytes");
  const snapshot = await materializeDirectory(root);
  t.after(() => rm(snapshot, { recursive: true, force: true }));
  await writeFile(join(root, "assets", "app.js"), "later build");
  assert.equal(
    await readFile(join(snapshot, "assets", "app.js"), "utf8"),
    "accepted bytes",
  );
});
