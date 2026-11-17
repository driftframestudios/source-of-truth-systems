import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMain,
  checkPortablePaths,
  checkSite,
  fileManifest,
  RELEASE_POLICY,
  sealRelease,
  selectRunArtifact,
  validateConfig,
  verifyCoordinates,
  verifyRelease,
} from "../scripts/documentation/release.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
function git(root, ...args) {
  return execFileSync("git", args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Release fixture",
      GIT_AUTHOR_EMAIL: "fixture@example.test",
      GIT_COMMITTER_NAME: "Release fixture",
      GIT_COMMITTER_EMAIL: "fixture@example.test",
    },
  })
    .toString()
    .trim();
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "sot-docs-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, "init", "--quiet");
  await copyFile(join(source, "LICENSE"), join(root, "LICENSE"));
  await writeFile(join(root, "README.md"), "Release fixture\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "Application fixture");
  const appRevision = git(root, "rev-parse", "HEAD");
  const config = {
    version: 1,
    appRevision,
    origin: RELEASE_POLICY.origin,
    base: "/",
    media: [],
  };
  await writeFile(join(root, "site-release.json"), JSON.stringify(config));
  git(root, "add", ".");
  git(root, "commit", "-qm", "Publication fixture");
  const publicationRevision = git(root, "rev-parse", "HEAD");
  git(root, "update-ref", "refs/remotes/origin/main", appRevision);
  git(root, "update-ref", "refs/remotes/origin/docs", publicationRevision);
  git(root, "tag", "docs-v1.0.0", publicationRevision);
  git(root, "checkout", "--quiet", "--detach", appRevision);
  const buildDirectory = join(root, "dist-foundation");
  await mkdir(join(buildDirectory, "assets"), { recursive: true });
  const files = {
    "index.html":
      '<html><link rel="canonical" href="https://kindlight.foundation/"><link href="/assets/site.css" rel="stylesheet"><a href="/">Home</a><a href="https://kindlight.ai">Application</a></html>',
    "404.html": '<a href="/">Return</a>',
    "assets/site.css": "body { color: navy; }",
    "llms.txt": "# Documentation\n",
    "llms-full.txt": "# Complete documentation\n",
    "routes.json": JSON.stringify({
      version: 1,
      routes: [{ route: "/", file: "index.html" }],
    }),
    "module-graph.json": JSON.stringify({
      sources: ["src/documentation/main.tsx", "src/app/theme/theme.ts"],
    }),
  };
  for (const [path, value] of Object.entries(files))
    await writeFile(join(buildDirectory, path), value);
  const coordinates = {
    appRevision,
    publicationRevision,
    workflowRevision: appRevision,
    releaseTag: "docs-v1.0.0",
  };
  const selection = {
    runId: "1234",
    runAttempt: 1,
    workflowRevision: appRevision,
  };
  const output = join(root, "artifact");
  return { root, config, coordinates, buildDirectory, output, selection };
}
async function sealed(t) {
  const f = await fixture(t);
  const receipt = await sealRelease({
    repository: f.root,
    buildDirectory: f.buildDirectory,
    output: f.output,
    coordinates: f.coordinates,
    ...f.selection,
  });
  return {
    ...f,
    receipt,
    verify: (extra = {}) =>
      verifyRelease({
        repository: f.root,
        directory: f.output,
        expectedDigest: receipt.manifestDigest,
        releaseTag: receipt.releaseTag,
        selection: f.selection,
        ...extra,
      }),
  };
}

test("accepted publication and immutable tag bind one exact application revision", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(verifyCoordinates(f.root, f.coordinates), f.config);
  assert.throws(
    () =>
      validateConfig(
        { ...f.config, appRevision: "a".repeat(40) },
        f.coordinates.appRevision,
      ),
    /configuration/,
  );
  assert.throws(
    () =>
      validateConfig(
        { ...f.config, media: [{ source: "outside" }] },
        f.coordinates.appRevision,
      ),
    /media/,
  );
  assert.throws(
    () =>
      validateConfig(
        { ...f.config, command: "run" },
        f.coordinates.appRevision,
      ),
    /configuration/,
  );
  assert.throws(() =>
    verifyCoordinates(f.root, {
      ...f.coordinates,
      appRevision: f.coordinates.publicationRevision,
    }),
  );
  assert.throws(
    () =>
      verifyCoordinates(f.root, {
        ...f.coordinates,
        publicationRevision: f.coordinates.appRevision,
      }),
    /tag/,
  );
  git(
    f.root,
    "update-ref",
    "refs/remotes/origin/docs",
    f.coordinates.appRevision,
  );
  assert.throws(() => verifyCoordinates(f.root, f.coordinates));
});

test("sealed files survive transfer; changed, additional or omitted files stop activation", async (t) => {
  const f = await sealed(t);
  assert.deepEqual(await f.verify(), f.receipt);
  const css = join(f.output, "site/assets/site.css"),
    original = await readFile(css);
  await writeFile(css, "body { color: red; }");
  await assert.rejects(f.verify(), /file manifest/);
  await writeFile(css, original);
  await writeFile(join(f.output, "site/extra.txt"), "unreviewed");
  await assert.rejects(f.verify(), /file manifest/);
  await rm(join(f.output, "site/extra.txt"));
  await rm(css);
  await assert.rejects(f.verify(), /file manifest/);
});

test("receipt selection rejects another digest, tag, run attempt or trusted workflow", async (t) => {
  const f = await sealed(t);
  await assert.rejects(
    f.verify({ expectedDigest: "0".repeat(64) }),
    /coordinates/,
  );
  await assert.rejects(f.verify({ releaseTag: "docs-v1.0.1" }), /coordinates/);
  await assert.rejects(
    f.verify({ selection: { ...f.selection, runAttempt: 2 } }),
    /coordinates/,
  );
  await assert.rejects(
    f.verify({
      selection: {
        ...f.selection,
        workflowRevision: f.coordinates.publicationRevision,
      },
    }),
    /coordinates/,
  );
  const receipt = JSON.parse(
    await readFile(join(f.output, "receipt.json"), "utf8"),
  );
  await writeFile(
    join(f.output, "receipt.json"),
    JSON.stringify({ ...receipt, files: receipt.files + 1 }),
  );
  await assert.rejects(f.verify(), /summary/);
});

test("static population rejects links and portable path collisions", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "sot-docs-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "file.txt"), "data");
  await symlink("file.txt", join(root, "alias.txt"));
  await assert.rejects(fileManifest(root), /symbolic/);
  await rm(join(root, "alias.txt"));
  await link(join(root, "file.txt"), join(root, "linked.txt"));
  await assert.rejects(fileManifest(root), /hard links/);
  await rm(join(root, "linked.txt"));
  await mkdir(join(root, "A"));
  await writeFile(join(root, "A/one.txt"), "one");
  assert.equal((await fileManifest(root)).files.length, 2);
  assert.throws(
    () => checkPortablePaths(["A/one.txt", "a/two.txt"]),
    /distinct/,
  );
  assert.throws(() => checkPortablePaths(["../outside.txt"]), /unexpected/);
  await mkdir(join(root, ".git"));
  await writeFile(join(root, ".git/config"), "private");
  await assert.rejects(fileManifest(root), /unexpected/);
});

test("generated articles require complete local links, correct canonical origin and isolated imports", async (t) => {
  const f = await sealed(t),
    site = join(f.output, "site");
  await writeFile(join(site, "404.html"), '<a href="/missing/">Missing</a>');
  await assert.rejects(checkSite(site, await fileManifest(site)), /missing/);
  await writeFile(join(site, "404.html"), '<a href="/">Home</a>');
  await writeFile(
    join(site, "module-graph.json"),
    JSON.stringify({ sources: ["src/app/App.tsx"] }),
  );
  await assert.rejects(checkSite(site, await fileManifest(site)), /isolated/);
  await writeFile(
    join(site, "module-graph.json"),
    JSON.stringify({ sources: ["src/documentation/main.tsx"] }),
  );
  await writeFile(
    join(site, "index.html"),
    '<link rel="canonical" href="https://kindlight.ai/docs/">',
  );
  await assert.rejects(checkSite(site, await fileManifest(site)), /canonical/);
});

test("activation admits one retained artifact from the successful main preflight attempt", () => {
  const repository = { full_name: RELEASE_POLICY.repository },
    revision = "a".repeat(40);
  const run = {
    id: 1234,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    repository,
    head_repository: repository,
    path: RELEASE_POLICY.workflow,
    workflow_id: 44,
    head_sha: revision,
    run_attempt: 2,
  };
  const workflow = { id: 44, path: RELEASE_POLICY.workflow };
  const artifact = {
    id: 55,
    name: "documentation-preflight-1234-2",
    expired: false,
    workflow_run: { id: 1234, head_sha: revision },
  };
  const select = (r = run, a = [artifact]) =>
    selectRunArtifact(r, workflow, a, "1234");
  assert.deepEqual(select(), {
    artifactId: 55,
    runId: "1234",
    runAttempt: 2,
    workflowRevision: revision,
  });
  for (const change of [
    { event: "pull_request" },
    { conclusion: "failure" },
    { head_branch: "feature" },
    { path: "other.yml" },
    { head_repository: { full_name: "fork/example" } },
    { workflow_id: 45 },
  ])
    assert.throws(() => select({ ...run, ...change }), /preflight/);
  assert.throws(
    () => select(run, [{ ...artifact, expired: true }]),
    /retained/,
  );
  assert.throws(
    () =>
      select(run, [{ ...artifact, name: "documentation-preflight-1234-1" }]),
    /retained/,
  );
  assert.throws(() => select(run, [artifact, artifact]), /retained/);
  assert.throws(
    () =>
      select(run, [
        { ...artifact, workflow_run: { id: 1235, head_sha: revision } },
      ]),
    /retained/,
  );
  assertMain("refs/heads/main", RELEASE_POLICY.repository);
  assert.throws(
    () => assertMain("refs/heads/docs", RELEASE_POLICY.repository),
    /protected main/,
  );
});
