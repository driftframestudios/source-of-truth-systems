import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  selectVerification,
  verifyOutcomes,
} from "../scripts/ci/verify-change.mjs";

const selector = fileURLToPath(
  new URL("../scripts/ci/verify-change.mjs", import.meta.url),
);
const outcomes = (route) => ({
  prepare: "success",
  selection: "success",
  build: "success",
  checks: "success",
  scan: "success",
  identity: "success",
  types: route === "core" ? "success" : "skipped",
  geometry: route === "core" ? "success" : "skipped",
});

test("documentation has a bounded route; mixed, empty and unknown owners receive Core", () => {
  for (const paths of [
    ["README.md"],
    ["docs/guide.md", "LICENSE", "docs/content-manifest.json"],
  ])
    assert.equal(selectVerification(paths).route, "docs");
  for (const paths of [
    [],
    ["src/app/App.tsx"],
    ["README.md", "package.json"],
    ["docs/example.sql"],
    ["future-owner.config"],
  ])
    assert.equal(selectVerification(paths).route, "core");
  assert.equal(selectVerification(["README.md"], { full: true }).route, "core");
  assert.throws(() => selectVerification(["../README.md"]));
});

test("required results refuse failure, cancellation, missing observations and unintended skips", () => {
  for (const route of ["docs", "core"]) {
    const selection = selectVerification(
      route === "docs" ? ["README.md"] : ["package.json"],
    );
    assert.equal(verifyOutcomes(selection, outcomes(route)), true);
    for (const name of [
      "prepare",
      "selection",
      "build",
      "checks",
      "scan",
      "identity",
    ])
      for (const value of ["failure", "cancelled", "skipped", undefined])
        assert.throws(
          () =>
            verifyOutcomes(selection, { ...outcomes(route), [name]: value }),
          `${route}: ${name} ${value}`,
        );
    assert.throws(() =>
      verifyOutcomes(selection, {
        ...outcomes(route),
        types: route === "docs" ? "success" : "skipped",
      }),
    );
  }
  assert.throws(() =>
    verifyOutcomes(
      { version: 1, route: "none", scan: "committed-tree" },
      outcomes("core"),
    ),
  );
});

async function repository(t) {
  const dir = await mkdtemp(join(tmpdir(), "sot-verification-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q");
  git("config", "user.name", "Verification fixture");
  git("config", "user.email", "fixture@example.invalid");
  await mkdir(join(dir, "src"));
  await writeFile(join(dir, "src/owner.mjs"), "export const example = true;\n");
  await writeFile(join(dir, "README.md"), "# Example\n");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Initial fixture");
  const run = (mode, destination, extra = {}) =>
    spawnSync(process.execPath, [selector, mode], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_OUTPUT: "",
        GITHUB_STEP_SUMMARY: "",
        BASE_COMMIT: "",
        VERIFICATION_SELECTION: destination,
        ...extra,
      },
    });
  return { dir, git, run };
}

test("actual rename comparisons retain the deleted source owner and missing bases fail selection", async (t) => {
  const { dir, git, run } = await repository(t),
    base = git("rev-parse", "HEAD");
  git("mv", "src/owner.mjs", "renamed.md");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Move example");
  const destination = join(dir, "selection.json");
  assert.equal(run("select", destination, { BASE_COMMIT: base }).status, 0);
  const selected = JSON.parse(await readFile(destination, "utf8"));
  assert.equal(selected.route, "core");
  assert.equal(selected.changedFiles, 2);
  assert.notEqual(
    run("select", join(dir, "missing.json"), { BASE_COMMIT: "0".repeat(40) })
      .status,
    0,
  );
  await assert.rejects(readFile(join(dir, "missing.json")));
});

test("a receipt binds selected results to the same committed source and cannot be overwritten", async (t) => {
  const { dir, git, run } = await repository(t),
    base = git("rev-parse", "HEAD");
  await writeFile(join(dir, "README.md"), "# Updated example\n");
  git("add", "README.md");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "Update guide");
  const destination = join(dir, "selection.json"),
    env = { VERIFICATION_OUTCOMES: JSON.stringify(outcomes("docs")) };
  assert.equal(run("select", destination, { BASE_COMMIT: base }).status, 0);
  assert.equal(JSON.parse(await readFile(destination, "utf8")).route, "docs");
  assert.equal(run("finish", destination, env).status, 0);
  assert.notEqual(run("select", destination).status, 0);
  git(
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--allow-empty",
    "-qm",
    "Later revision",
  );
  const later = run("finish", destination, env);
  assert.notEqual(later.status, 0);
  assert.match(later.stderr, /source identity changed/);
  const full = join(dir, "full.json");
  assert.equal(run("select", full).status, 0);
  assert.equal(JSON.parse(await readFile(full, "utf8")).route, "core");
});
