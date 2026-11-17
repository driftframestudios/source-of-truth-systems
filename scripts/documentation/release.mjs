import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyDocumentation } from "../ci/verify-docs.mjs";

export const RELEASE_POLICY = Object.freeze({
  repository: "driftframestudios/source-of-truth-systems",
  origin: "https://kindlight.foundation",
  workflow: ".github/workflows/documentation-preflight.yml",
  maxFiles: 2000,
  maxFileBytes: 100_000_000,
  maxBytes: 1_000_000_000,
});
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const tag = /^docs-v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const id = /^[1-9]\d{0,15}$/;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function exactKeys(value, keys) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...keys].sort().join("|")
  );
}
function gitBytes(repository, ...args) {
  return execFileSync("git", args, {
    cwd: repository,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 2_000_000,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.toUpperCase().startsWith("GIT_"),
        ),
      ),
      GIT_NO_REPLACE_OBJECTS: "1",
    },
  });
}
const git = (repository, ...args) =>
  gitBytes(repository, ...args)
    .toString()
    .trim();
export function assertMain(ref, repository) {
  requireValue(
    ref === "refs/heads/main" && repository === RELEASE_POLICY.repository,
    "Run this release workflow from this repository's protected main branch.",
  );
}
export function validateConfig(config, appRevision) {
  requireValue(
    exactKeys(config, ["version", "appRevision", "origin", "base", "media"]) &&
      config.version === 1 &&
      config.appRevision === appRevision &&
      sha.test(appRevision) &&
      config.origin === RELEASE_POLICY.origin &&
      config.base === "/" &&
      Array.isArray(config.media) &&
      config.media.length === 0,
    "Use the reviewed version-one site configuration and its exact application revision; added media needs its own reviewed contract.",
  );
  return config;
}
export function verifyCoordinates(repository, coordinates) {
  for (const key of [
    "appRevision",
    "publicationRevision",
    "workflowRevision",
  ]) {
    requireValue(
      sha.test(coordinates[key] ?? ""),
      "Select full application, publication and workflow commits.",
    );
    requireValue(
      git(repository, "cat-file", "-t", coordinates[key]) === "commit",
      "Select commit objects.",
    );
  }
  requireValue(
    tag.test(coordinates.releaseTag ?? ""),
    "Select a docs-vMAJOR.MINOR.PATCH release tag.",
  );
  git(
    repository,
    "merge-base",
    "--is-ancestor",
    coordinates.appRevision,
    "refs/remotes/origin/main",
  );
  git(
    repository,
    "merge-base",
    "--is-ancestor",
    coordinates.workflowRevision,
    "refs/remotes/origin/main",
  );
  git(
    repository,
    "merge-base",
    "--is-ancestor",
    coordinates.publicationRevision,
    "refs/remotes/origin/docs",
  );
  requireValue(
    git(
      repository,
      "rev-parse",
      `refs/tags/${coordinates.releaseTag}^{commit}`,
    ) === coordinates.publicationRevision,
    "The immutable documentation tag must select the accepted publication commit.",
  );
  return validateConfig(
    JSON.parse(
      git(
        repository,
        "show",
        `${coordinates.publicationRevision}:site-release.json`,
      ),
    ),
    coordinates.appRevision,
  );
}

function admitPath(path) {
  const parts = path.split("/");
  requireValue(
    !/[\\\x00-\x1f\x7f:]/.test(path) &&
      parts.every((part) => part && part !== "." && part !== "..") &&
      (!parts.some((part) => part.startsWith(".")) ||
        path === ".nojekyll" ||
        path === ".vite/manifest.json"),
    "The static artifact contains an unexpected or nonportable path.",
  );
}
export function checkPortablePaths(paths) {
  const folded = new Map();
  for (const path of paths) {
    admitPath(path);
    const parts = path.split("/");
    for (let index = 1; index <= parts.length; index++) {
      const part = parts.slice(0, index).join("/"),
        key = part.toLowerCase();
      requireValue(
        !folded.has(key) || folded.get(key) === part,
        "Static paths must remain distinct across filesystems.",
      );
      folded.set(key, part);
    }
  }
}
/** A deterministic content manifest, independent of ZIP/tar timestamps and filesystem ordering. */
export async function fileManifest(directory) {
  const files = [];
  let total = 0;
  async function visit(relative = "") {
    const absolute = join(directory, relative),
      stat = await lstat(absolute);
    requireValue(
      !stat.isSymbolicLink(),
      "Release artifacts contain ordinary files, not symbolic links.",
    );
    if (stat.isDirectory()) {
      for (const name of (await readdir(absolute)).sort())
        await visit(relative ? `${relative}/${name}` : name);
      return;
    }
    admitPath(relative);
    requireValue(
      stat.isFile() &&
        stat.nlink === 1 &&
        stat.size <= RELEASE_POLICY.maxFileBytes,
      "Release artifacts require bounded ordinary files without hard links.",
    );
    total += stat.size;
    requireValue(
      files.length < RELEASE_POLICY.maxFiles &&
        total <= RELEASE_POLICY.maxBytes,
      "Static publication exceeds its reviewed budget.",
    );
    files.push({
      path: relative,
      bytes: stat.size,
      sha256: hash(await readFile(absolute)),
    });
  }
  requireValue(
    (await lstat(directory)).isDirectory(),
    "Select a static artifact directory.",
  );
  await visit();
  checkPortablePaths(files.map((file) => file.path));
  return {
    version: 1,
    files: files.sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    ),
  };
}
export async function checkSite(directory, manifest) {
  const paths = new Set(manifest.files.map((file) => file.path));
  for (const path of [
    "index.html",
    "404.html",
    "llms.txt",
    "llms-full.txt",
    "routes.json",
    "module-graph.json",
    "CNAME",
    "LICENSE",
  ])
    requireValue(
      paths.has(path),
      "The static build is missing a required documentation carrier.",
    );
  requireValue(
    (await readFile(join(directory, "CNAME"), "utf8")).trim() ===
      "kindlight.foundation",
    "The release domain must remain kindlight.foundation.",
  );
  const routes = JSON.parse(
    await readFile(join(directory, "routes.json"), "utf8"),
  );
  requireValue(
    routes.version === 1 &&
      Array.isArray(routes.routes) &&
      routes.routes.length > 0 &&
      routes.routes.length <= 100,
    "The generated documentation route manifest is invalid.",
  );
  const routeNames = new Set();
  for (const route of routes.routes) {
    requireValue(
      exactKeys(route, ["route", "file"]) &&
        /^\/(?:[a-z0-9-]+\/)?$/.test(route.route) &&
        route.file === `${route.route.slice(1)}index.html` &&
        paths.has(route.file) &&
        !routeNames.has(route.route),
      "Each documentation route must name one generated article.",
    );
    routeNames.add(route.route);
    const html = await readFile(join(directory, route.file), "utf8");
    requireValue(
      html.includes(
        `rel="canonical" href="${RELEASE_POLICY.origin}${route.route}"`,
      ),
      "Generated articles must retain the foundation canonical origin and base.",
    );
  }
  const graph = JSON.parse(
    await readFile(join(directory, "module-graph.json"), "utf8"),
  );
  requireValue(
    Array.isArray(graph.sources) &&
      graph.sources.length > 0 &&
      graph.sources.every((source) =>
        /^src\/(documentation\/|app\/theme\/|styles\/fonts\.css$)/.test(source),
      ),
    "The documentation entry must remain isolated from application state.",
  );
  let checkedLinks = 0;
  for (const { path } of manifest.files.filter((file) =>
    file.path.endsWith(".html"),
  )) {
    const html = await readFile(join(directory, path), "utf8");
    for (const match of html.matchAll(
      /\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi,
    )) {
      const target = match[2].replaceAll("&amp;", "&");
      if (/^(?:https?:|mailto:)/i.test(target) || target.startsWith("#"))
        continue;
      requireValue(
        !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target) && !target.includes("\\"),
        "A generated link has an unsupported destination.",
      );
      const pathname = decodeURIComponent(target.split(/[?#]/, 1)[0]);
      if (!pathname) continue;
      const destination = posix.normalize(
        pathname.startsWith("/")
          ? pathname.slice(1)
          : posix.join(posix.dirname(path), pathname),
      );
      requireValue(
        !destination.startsWith("../") &&
          [destination, posix.join(destination, "index.html")].some(
            (candidate) => paths.has(candidate),
          ),
        "A generated article link or asset is missing from the reviewed artifact.",
      );
      checkedLinks++;
    }
  }
  return {
    files: manifest.files.length,
    bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
    checkedLinks,
  };
}
function validateReceipt(receipt) {
  requireValue(
    exactKeys(receipt, [
      "version",
      "repository",
      "appRevision",
      "publicationRevision",
      "workflowRevision",
      "releaseTag",
      "runId",
      "runAttempt",
      "manifestDigest",
      "files",
      "bytes",
    ]) &&
      receipt.version === 1 &&
      receipt.repository === RELEASE_POLICY.repository &&
      [
        receipt.appRevision,
        receipt.publicationRevision,
        receipt.workflowRevision,
      ].every((value) => sha.test(value ?? "")) &&
      tag.test(receipt.releaseTag ?? "") &&
      id.test(receipt.runId ?? "") &&
      Number.isSafeInteger(receipt.runAttempt) &&
      receipt.runAttempt > 0 &&
      digest.test(receipt.manifestDigest ?? "") &&
      Number.isSafeInteger(receipt.files) &&
      Number.isSafeInteger(receipt.bytes),
    "The artifact release receipt is invalid.",
  );
}
export async function sealRelease({
  repository,
  buildDirectory,
  output,
  coordinates,
  runId,
  runAttempt,
}) {
  verifyCoordinates(repository, coordinates);
  requireValue(
    git(repository, "rev-parse", "HEAD") === coordinates.appRevision,
    "Build the selected application checkout.",
  );
  const before = await fileManifest(buildDirectory);
  requireValue(
    !before.files.some((file) => ["CNAME", "LICENSE"].includes(file.path)),
    "The builder and publication carriers have distinct owners.",
  );
  await mkdir(output);
  const site = join(output, "site");
  await mkdir(site);
  for (const { path } of before.files) {
    await mkdir(dirname(join(site, path)), { recursive: true });
    await writeFile(
      join(site, path),
      await readFile(join(buildDirectory, path)),
      { flag: "wx" },
    );
  }
  await writeFile(join(site, "CNAME"), "kindlight.foundation\n", {
    flag: "wx",
  });
  // Exact committed notice bytes accompany the generated carrier.
  await writeFile(
    join(site, "LICENSE"),
    gitBytes(
      repository,
      "cat-file",
      "blob",
      "84e69e8cc706bb43ae6fc2b900ffd1c5d61a11a4",
    ),
    { flag: "wx" },
  );
  const manifest = await fileManifest(site),
    observation = await checkSite(site, manifest),
    bytes = encode(manifest);
  const receipt = {
    version: 1,
    repository: RELEASE_POLICY.repository,
    ...coordinates,
    runId,
    runAttempt,
    manifestDigest: hash(bytes),
    files: observation.files,
    bytes: observation.bytes,
  };
  validateReceipt(receipt);
  await writeFile(join(output, "manifest.json"), bytes, { flag: "wx" });
  await writeFile(join(output, "receipt.json"), encode(receipt), {
    flag: "wx",
  });
  return receipt;
}
export function selectRunArtifact(run, workflow, artifacts, runId) {
  requireValue(
    id.test(runId ?? "") &&
      String(run.id) === runId &&
      run.event === "workflow_dispatch" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.head_branch === "main" &&
      run.repository?.full_name === RELEASE_POLICY.repository &&
      run.head_repository?.full_name === RELEASE_POLICY.repository &&
      run.path === RELEASE_POLICY.workflow &&
      workflow.path === RELEASE_POLICY.workflow &&
      run.workflow_id === workflow.id &&
      sha.test(run.head_sha ?? "") &&
      Number.isSafeInteger(run.run_attempt) &&
      run.run_attempt > 0,
    "Select a successful manual preflight from this repository's protected main workflow.",
  );
  const expected = `documentation-preflight-${runId}-${run.run_attempt}`;
  const matches = artifacts.filter((artifact) => artifact.name === expected);
  requireValue(
    matches.length === 1 &&
      !matches[0].expired &&
      Number.isSafeInteger(matches[0].id) &&
      matches[0].workflow_run?.id === run.id &&
      matches[0].workflow_run?.head_sha === run.head_sha,
    "The selected preflight attempt needs exactly one retained artifact.",
  );
  return {
    artifactId: matches[0].id,
    runId,
    runAttempt: run.run_attempt,
    workflowRevision: run.head_sha,
  };
}
async function github(path) {
  const response = await fetch(
    `https://api.github.com/repos/${RELEASE_POLICY.repository}/${path}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    },
  );
  requireValue(
    response.ok,
    `GitHub release metadata is unavailable (${response.status}).`,
  );
  return response.json();
}
export async function verifyRelease({
  repository,
  directory,
  expectedDigest,
  releaseTag,
  selection,
}) {
  requireValue(
    digest.test(expectedDigest ?? "") && tag.test(releaseTag ?? ""),
    "Supply the reviewed file-manifest digest and documentation tag.",
  );
  requireValue(
    (await readdir(directory)).sort().join("|") ===
      "manifest.json|receipt.json|site",
    "The release artifact has an unexpected population.",
  );
  for (const path of ["manifest.json", "receipt.json"]) {
    const stat = await lstat(join(directory, path));
    requireValue(
      stat.isFile() &&
        !stat.isSymbolicLink() &&
        stat.nlink === 1 &&
        stat.size <= 1_000_000,
      "Release metadata must be bounded ordinary files.",
    );
  }
  const receipt = JSON.parse(
    await readFile(join(directory, "receipt.json"), "utf8"),
  );
  validateReceipt(receipt);
  requireValue(
    receipt.manifestDigest === expectedDigest &&
      receipt.releaseTag === releaseTag &&
      receipt.runId === selection.runId &&
      receipt.runAttempt === selection.runAttempt &&
      receipt.workflowRevision === selection.workflowRevision,
    "The reviewed artifact coordinates differ from the selected preflight.",
  );
  const bytes = await readFile(join(directory, "manifest.json"));
  const manifest = await fileManifest(join(directory, "site"));
  requireValue(
    hash(bytes) === expectedDigest && bytes.toString() === encode(manifest),
    "The artifact files differ from the reviewed file manifest.",
  );
  const observation = await checkSite(join(directory, "site"), manifest);
  requireValue(
    receipt.files === observation.files && receipt.bytes === observation.bytes,
    "The artifact summary differs from its file population.",
  );
  verifyCoordinates(repository, receipt);
  const license = await readFile(join(directory, "site", "LICENSE"));
  requireValue(
    hash(license) ===
      hash(
        gitBytes(
          repository,
          "cat-file",
          "blob",
          "84e69e8cc706bb43ae6fc2b900ffd1c5d61a11a4",
        ),
      ),
    "Retain the approved license bytes.",
  );
  return receipt;
}
async function output(name, value) {
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
async function summary(receipt) {
  console.log(JSON.stringify(receipt));
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### Reviewed documentation artifact\n\n- Tag: \`${receipt.releaseTag}\`\n- Application: \`${receipt.appRevision}\`\n- Publication: \`${receipt.publicationRevision}\`\n- Preflight workflow: \`${receipt.workflowRevision}\`\n- Preflight: ${receipt.runId}, attempt ${receipt.runAttempt}\n- File-manifest SHA-256: \`${receipt.manifestDigest}\`\n- Population: ${receipt.files} files, ${receipt.bytes} bytes\n\nActivation verifies these same files. Host behavior remains a separate receiving check.\n`,
    );
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const [command] = process.argv.slice(2),
      repository = process.cwd();
    assertMain(process.env.GITHUB_REF, process.env.GITHUB_REPOSITORY);
    const coordinates = {
      appRevision: process.env.APP_REVISION,
      publicationRevision: process.env.PUBLICATION_REVISION,
      workflowRevision: process.env.GITHUB_SHA,
      releaseTag: process.env.RELEASE_TAG,
    };
    if (command === "prepare") {
      verifyCoordinates(repository, coordinates);
      await mkdir(dirname(process.env.RELEASE_STATE), { recursive: true });
      await mkdir(process.env.RELEASE_STATE);
      await verifyDocumentation({
        repository,
        commit: coordinates.publicationRevision,
        output: join(process.env.RELEASE_STATE, "publication"),
      });
    } else if (command === "seal") {
      await summary(
        await sealRelease({
          repository,
          buildDirectory: join(repository, "dist-foundation"),
          output: process.env.RELEASE_ARTIFACT,
          coordinates,
          runId: process.env.GITHUB_RUN_ID,
          runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
        }),
      );
    } else if (command === "resolve") {
      const runId = process.env.PREFLIGHT_RUN;
      requireValue(id.test(runId ?? ""), "Select a numeric preflight run ID.");
      const [run, workflow, listing] = await Promise.all([
        github(`actions/runs/${runId}`),
        github("actions/workflows/documentation-preflight.yml"),
        github(`actions/runs/${runId}/artifacts?per_page=100`),
      ]);
      requireValue(
        listing.total_count <= 100,
        "The preflight artifact population exceeds the bounded lookup.",
      );
      const selection = selectRunArtifact(
        run,
        workflow,
        listing.artifacts,
        runId,
      );
      await writeFile(process.env.RELEASE_SELECTION, encode(selection), {
        flag: "wx",
      });
      await output("artifact_id", selection.artifactId);
    } else if (command === "verify") {
      const selection = JSON.parse(
        await readFile(process.env.RELEASE_SELECTION, "utf8"),
      );
      await summary(
        await verifyRelease({
          repository,
          directory: process.env.RELEASE_ARTIFACT,
          expectedDigest: process.env.MANIFEST_DIGEST,
          releaseTag: process.env.RELEASE_TAG,
          selection,
        }),
      );
    } else throw new Error("Choose prepare, seal, resolve or verify.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
