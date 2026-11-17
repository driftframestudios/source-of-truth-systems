import { isDirectExecution } from "./runtime.mjs";
import { createHash, randomBytes } from "node:crypto";
import { constants as filesystemConstants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  BETTERLEAKS_RELEASE,
  BetterleaksInstallError,
  verifyBetterleaksInstall,
} from "./install-betterleaks.mjs";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const CONFIG_PATH = resolve(REPOSITORY_ROOT, ".betterleaks.toml");
import { materializeZip, safeRelativePath } from "./zip-snapshot.mjs";

const FINDINGS_EXIT_CODE = 10;
const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;
const CANARY_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SCANNER_IGNORE_FILENAMES = new Set([
  ".betterleaksignore",
  ".gitleaksignore",
]);
const GIT_TARGET_ENVIRONMENT_KEYS = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_EXEC_PATH",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NAMESPACE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
]);
const CHILD_ENVIRONMENT_KEYS = [
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
  "USERPROFILE",
  "WINDIR",
  "XDG_CONFIG_HOME",
];

export class SecretScanError extends Error {
  constructor(code, message, options) {
    super(`${code}: ${message}`, options);
    this.name = "SecretScanError";
    this.code = code;
  }
}

export class SecretScanFindingsError extends SecretScanError {
  constructor(scope, findings) {
    super(
      "SECRET_SCAN_FINDINGS",
      `${scope} contains ${findings.length} unresolved secret-shaped candidate${findings.length === 1 ? "" : "s"}`,
    );
    this.name = "SecretScanFindingsError";
    this.scope = scope;
    this.findings = findings;
  }
}

export function isPathWithin(
  parent,
  candidate,
  pathFunctions = { isAbsolute, relative, sep },
) {
  const path = pathFunctions.relative(parent, candidate);
  return (
    path === "" ||
    (!pathFunctions.isAbsolute(path) &&
      path !== ".." &&
      !path.startsWith(`..${pathFunctions.sep}`))
  );
}

function safeRuleId(value) {
  return typeof value === "string" &&
    /^[a-z0-9][a-z0-9._-]{0,127}$/i.test(value)
    ? value
    : "unknown-rule";
}

function appendBounded(chunks, chunk, state, child) {
  state.bytes += chunk.length;
  if (state.bytes > MAX_CAPTURE_BYTES) {
    child.kill();
    state.exceeded = true;
    return;
  }
  chunks.push(chunk);
}

function repositoryProcessEnvironment() {
  const environment = {};
  for (const key of CHILD_ENVIRONMENT_KEYS) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  for (const key of Object.keys(environment)) {
    const normalized = key.toUpperCase();
    if (
      GIT_TARGET_ENVIRONMENT_KEYS.has(normalized) ||
      normalized.startsWith("GIT_CONFIG_KEY_") ||
      normalized.startsWith("GIT_CONFIG_VALUE_") ||
      normalized.startsWith("GIT_TRACE")
    ) {
      delete environment[key];
    }
  }
  environment.GIT_NO_REPLACE_OBJECTS = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.NO_COLOR = "1";
  return environment;
}

export function runProcess(
  binaryPath,
  args,
  { input, cwd = REPOSITORY_ROOT } = {},
) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binaryPath, args, {
      cwd,
      env: repositoryProcessEnvironment(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    const state = { bytes: 0, exceeded: false };

    child.once("error", (error) => {
      rejectPromise(
        new SecretScanError(
          "SECRET_SCANNER_PROCESS_START",
          "the pinned scanner executable could not start",
          { cause: error },
        ),
      );
    });
    child.stdout.on("data", (chunk) =>
      appendBounded(stdoutChunks, chunk, state, child),
    );
    child.stderr.on("data", (chunk) =>
      appendBounded(stderrChunks, chunk, state, child),
    );
    child.once("close", (code, signal) => {
      if (state.exceeded) {
        rejectPromise(
          new SecretScanError(
            "SECRET_SCANNER_OUTPUT_BOUNDARY",
            "scanner output exceeded the in-memory redacted-report boundary",
          ),
        );
        return;
      }
      resolvePromise({
        code,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });

    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}

function parseScannerFindings(reportText) {
  let parsed;
  try {
    parsed = JSON.parse(reportText);
  } catch (error) {
    throw new SecretScanError(
      "SECRET_SCANNER_REPORT_INVALID",
      "the scanner did not return its expected JSON report",
      { cause: error },
    );
  }
  const findings = parsed === null ? [] : parsed;
  if (!Array.isArray(findings)) {
    throw new SecretScanError(
      "SECRET_SCANNER_REPORT_INVALID",
      "the scanner report is not a finding array",
    );
  }

  for (const finding of findings) {
    if (
      finding?.Secret !== "REDACTED" ||
      typeof finding?.Match !== "string" ||
      !finding.Match.includes("REDACTED")
    ) {
      throw new SecretScanError(
        "SECRET_SCANNER_REPORT_REDACTION",
        "the scanner report did not fully mask a candidate value",
      );
    }
  }
  return findings;
}

function safeFinding(finding, index) {
  return {
    ordinal: index + 1,
    rule: safeRuleId(finding.RuleID),
    line: Number.isSafeInteger(finding.StartLine) ? finding.StartLine : null,
    commit:
      typeof finding.Commit === "string" &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(finding.Commit)
        ? finding.Commit.slice(0, 12)
        : null,
  };
}

function commonArguments(configPath) {
  return [
    "--config",
    configPath,
    "--redact=100",
    "--report-format",
    "json",
    "--report-path",
    "-",
    "--exit-code",
    String(FINDINGS_EXIT_CODE),
    "--no-banner",
    "--no-color",
    "--ignore-gitleaks-allow",
    "--timeout",
    "180",
    "--validation=false",
    "--max-archive-depth=0",
  ];
}

export async function executeSecretScan({
  binaryPath,
  configPath = CONFIG_PATH,
  cwd = REPOSITORY_ROOT,
  scannerArguments,
  input,
  processRunner = runProcess,
  scope,
}) {
  const result = await processRunner(
    binaryPath,
    [...scannerArguments, ...commonArguments(configPath)],
    { input, cwd },
  );

  if (result.signal || ![0, FINDINGS_EXIT_CODE].includes(result.code)) {
    throw new SecretScanError(
      "SECRET_SCANNER_OPERATIONAL_FAILURE",
      `${scope} did not complete; scanner diagnostics remain in the local process boundary`,
    );
  }

  const sensitiveFindings = parseScannerFindings(result.stdout);
  if (result.code === 0 && sensitiveFindings.length > 0) {
    throw new SecretScanError(
      "SECRET_SCANNER_EXIT_CONTRACT",
      `${scope} returned findings with a clean exit status`,
    );
  }
  if (result.code === FINDINGS_EXIT_CODE && sensitiveFindings.length === 0) {
    throw new SecretScanError(
      "SECRET_SCANNER_EXIT_CONTRACT",
      `${scope} returned a finding exit status without a redacted finding`,
    );
  }

  return {
    findings: sensitiveFindings.map(safeFinding),
  };
}

export function generateSyntheticCanary(bytes = randomBytes(36)) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 36) {
    throw new SecretScanError(
      "SECRET_SCANNER_CANARY_SOURCE",
      "the synthetic canary requires 36 random bytes",
    );
  }
  let token = "ghp_";
  for (const byte of bytes)
    token += CANARY_ALPHABET[byte % CANARY_ALPHABET.length];
  return token;
}

export async function runSyntheticCanary({
  binaryPath,
  configPath = CONFIG_PATH,
  processRunner = runProcess,
  canary = generateSyntheticCanary(),
} = {}) {
  const input = `GITHUB_TOKEN="${canary}"\n`;
  const result = await executeSecretScan({
    binaryPath,
    configPath,
    scannerArguments: ["stdin", "--isolate-rule", "github-pat"],
    input,
    processRunner,
    scope: "synthetic canary",
  });

  if (
    result.findings.length !== 1 ||
    result.findings[0]?.rule !== "github-pat"
  ) {
    throw new SecretScanError(
      "SECRET_SCANNER_CANARY_NOT_DETECTED",
      "the scanner did not detect exactly one generated GitHub-token canary",
    );
  }
  if (JSON.stringify(result).includes(canary)) {
    throw new SecretScanError(
      "SECRET_SCANNER_CANARY_DISCLOSED",
      "the generated canary crossed the redacted scanner-output boundary",
    );
  }

  return { detected: true, redacted: true, rule: "github-pat" };
}

function runGit(args, repositoryRoot = REPOSITORY_ROOT) {
  const result = spawnSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    env: repositoryProcessEnvironment(),
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new SecretScanError(
      "SECRET_SCANNER_GIT_STATE",
      "the repository state required for the selected scan is unavailable",
      { cause: result.error },
    );
  }
  return result;
}

function assertCompleteHistoryAvailable(repositoryRoot = REPOSITORY_ROOT) {
  const result = runGit(
    ["rev-parse", "--is-shallow-repository"],
    repositoryRoot,
  );
  if (result.status !== 0 || result.stdout.trim() !== "false") {
    throw new SecretScanError(
      "SECRET_SCANNER_SHALLOW_HISTORY",
      "fetch complete repository history and refs before using history mode",
    );
  }
}

async function findScannerIgnoreSurfaces(
  directory,
  found = [],
  root = directory,
) {
  await access(directory, filesystemConstants.R_OK | filesystemConstants.X_OK);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SCANNER_IGNORE_FILENAMES.has(entry.name.toLowerCase())) {
      found.push(join(directory, entry.name));
      continue;
    }
    if (entry.isDirectory()) {
      await findScannerIgnoreSurfaces(join(directory, entry.name), found, root);
    } else if (entry.isFile()) {
      await access(join(directory, entry.name), filesystemConstants.R_OK);
    } else {
      throw new SecretScanError(
        "SECRET_SCANNER_TREE_ENTRY_TYPE",
        "the scanned tree contains a symbolic link or special filesystem entry",
      );
    }
  }
  return found;
}

export async function assertSingleSuppressionSurface(
  repositoryRoot = REPOSITORY_ROOT,
) {
  let ignoreSurfaces;
  try {
    ignoreSurfaces = await findScannerIgnoreSurfaces(repositoryRoot);
  } catch (error) {
    if (error instanceof SecretScanError) throw error;
    throw new SecretScanError(
      "SECRET_SCANNER_TREE_CLOSURE",
      "the repository contains a path that cannot be read before scanning",
      { cause: error },
    );
  }
  if (ignoreSurfaces.length > 0) {
    throw new SecretScanError(
      "SECRET_SCANNER_SUPPRESSION_SURFACE",
      "route reviewed exceptions through .betterleaks.toml; ignore files are not part of this contract",
    );
  }
}

function inspectIndex(repositoryRoot) {
  const result = runGit(["ls-files", "--stage", "-z"], repositoryRoot);
  if (result.status !== 0) {
    throw new SecretScanError(
      "SECRET_SCANNER_INDEX_UNAVAILABLE",
      "the Git index could not be inspected",
    );
  }
  const entries = [];
  for (const record of result.stdout.split("\0")) {
    if (record === "") continue;
    const match = /^(\d+) ([a-f0-9]{40,64}) (\d)\t([\s\S]+)$/.exec(record);
    if (!match) {
      throw new SecretScanError(
        "SECRET_SCANNER_INDEX_INVALID",
        "the Git index contains an unreadable entry",
      );
    }
    const [, mode, oid, stage, path] = match;
    if (stage !== "0") {
      throw new SecretScanError(
        "SECRET_SCANNER_INDEX_CONFLICT",
        "resolve index conflicts before scanning staged material",
      );
    }
    if (!["100644", "100755"].includes(mode)) {
      throw new SecretScanError(
        "SECRET_SCANNER_INDEX_ENTRY_TYPE",
        "the Git index contains an entry that cannot be materialized as a regular scan input",
      );
    }
    entries.push({ mode, oid, path });
  }
  return entries;
}

function readIndexBlob(repositoryRoot, oid) {
  const result = spawnSync(
    "git",
    ["-C", repositoryRoot, "cat-file", "blob", oid],
    {
      encoding: null,
      env: repositoryProcessEnvironment(),
      windowsHide: true,
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new SecretScanError(
      "SECRET_SCANNER_INDEX_BLOB",
      "an indexed blob could not be read without worktree conversion",
      { cause: result.error },
    );
  }
  return result.stdout;
}

export async function materializeGitIndex(repositoryRoot = REPOSITORY_ROOT) {
  return materializeEntries(inspectIndex(repositoryRoot), repositoryRoot);
}

function resolveCommit(repositoryRoot, revision) {
  if (
    typeof revision !== "string" ||
    !revision ||
    revision.startsWith("-") ||
    /[\r\n\0]/.test(revision)
  ) {
    throw new SecretScanError(
      "SECRET_SCAN_REVISION",
      "choose one available source revision",
    );
  }
  const result = runGit(
    ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`],
    repositoryRoot,
  );
  if (result.status !== 0 || !/^[a-f0-9]{40,64}$/.test(result.stdout.trim())) {
    throw new SecretScanError(
      "SECRET_SCAN_REVISION",
      "the selected source revision is unavailable",
    );
  }
  return result.stdout.trim();
}

function committedEntries(repositoryRoot, revision, base) {
  const commit = resolveCommit(repositoryRoot, revision);
  const result = runGit(
    ["ls-tree", "-rz", "--full-tree", commit],
    repositoryRoot,
  );
  if (result.status !== 0)
    throw new SecretScanError(
      "SECRET_SCAN_TREE",
      "the committed tree is unavailable",
    );
  let selected;
  if (base) {
    const previous = resolveCommit(repositoryRoot, base);
    const diff = runGit(
      [
        "diff",
        "--name-only",
        "--diff-filter=ACMRT",
        "-z",
        previous,
        commit,
        "--",
      ],
      repositoryRoot,
    );
    if (diff.status !== 0)
      throw new SecretScanError(
        "SECRET_SCAN_DIFF",
        "the source comparison is unavailable",
      );
    selected = new Set(diff.stdout.split("\0").filter(Boolean));
  }
  const entries = result.stdout
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+) blob ([a-f0-9]{40,64})\t([\s\S]+)$/.exec(line);
      if (!match)
        throw new SecretScanError(
          "SECRET_SCAN_ENTRY",
          "the source contains a submodule or unsupported entry",
        );
      return { mode: match[1], oid: match[2], path: match[3] };
    })
    .filter((entry) => !selected || selected.has(entry.path));
  return { entries, commit };
}

async function checkedFile(root, path) {
  if (!safeRelativePath(path))
    throw new SecretScanError(
      "SECRET_SCAN_PATH",
      "a selected path is outside the materialization grammar",
    );
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const state = await lstat(join(root, ...parts.slice(0, i)));
    if (
      state.isSymbolicLink() ||
      !(i === parts.length ? state.isFile() : state.isDirectory())
    ) {
      throw new SecretScanError(
        "SECRET_SCAN_ENTRY",
        "a selected path crosses a symlink or special entry",
      );
    }
  }
  return join(root, path);
}

export async function materializeEntries(
  entries,
  repositoryRoot,
  working = false,
) {
  const snapshot = await mkdtemp(join(tmpdir(), "publication-source-"));
  try {
    for (const entry of entries) {
      if (
        !["100644", "100755"].includes(entry.mode) ||
        !safeRelativePath(entry.path)
      ) {
        throw new SecretScanError(
          "SECRET_SCAN_ENTRY",
          "selected source must use ordinary regular-file paths",
        );
      }
      const target = join(snapshot, entry.path);
      await mkdir(dirname(target), { recursive: true });
      if (working)
        await copyFile(
          await checkedFile(repositoryRoot, entry.path),
          target,
          filesystemConstants.COPYFILE_EXCL,
        );
      else
        await writeFile(target, readIndexBlob(repositoryRoot, entry.oid), {
          flag: "wx",
          mode: 0o600,
        });
    }
    return snapshot;
  } catch (error) {
    await rm(snapshot, { recursive: true, force: true });
    throw error;
  }
}

export async function resolveArtifactTarget(
  target,
  repositoryRoot = REPOSITORY_ROOT,
) {
  if (
    typeof target !== "string" ||
    !target ||
    !isPathWithin(repositoryRoot, resolve(repositoryRoot, target)) ||
    resolve(repositoryRoot, target) === repositoryRoot
  ) {
    throw new SecretScanError(
      "SECRET_SCAN_ARTIFACT",
      "choose one contained repository-relative artifact",
    );
  }
  const path = resolve(repositoryRoot, target);
  const parts = relative(repositoryRoot, path).split(sep);
  for (let i = 1; i <= parts.length; i++) {
    const state = await lstat(join(repositoryRoot, ...parts.slice(0, i)));
    if (
      state.isSymbolicLink() ||
      (!state.isDirectory() && !(i === parts.length && state.isFile()))
    ) {
      throw new SecretScanError(
        "SECRET_SCAN_ARTIFACT",
        "artifact selection must stay within ordinary files and directories",
      );
    }
  }
  if (!isPathWithin(await realpath(repositoryRoot), await realpath(path)))
    throw new SecretScanError(
      "SECRET_SCAN_ARTIFACT",
      "artifact selection escaped the repository",
    );
  return path;
}

export async function materializeDirectory(directory) {
  const entries = [];
  async function visit(root, prefix = "") {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(root, entry.name), path + "/");
      else if (entry.isFile()) entries.push({ mode: "100644", path });
      else
        throw new SecretScanError(
          "SECRET_SCAN_ENTRY",
          "the artifact contains a symlink or special entry",
        );
    }
  }
  await visit(directory);
  return materializeEntries(entries, directory, true);
}

async function snapshotIdentity(directory) {
  const hash = createHash("sha256");
  let files = 0;
  async function visit(path, prefix = "") {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(path, entry.name), name + "/");
      else if (entry.isFile()) {
        hash.update(name + "\0");
        hash.update(
          createHash("sha256")
            .update(await readFile(join(path, entry.name)))
            .digest(),
        );
        files++;
      } else
        throw new SecretScanError(
          "SECRET_SCAN_ENTRY",
          "the artifact contains a symlink or special entry",
        );
    }
  }
  await visit(directory);
  return { files, snapshotSha256: hash.digest("hex") };
}

const modes = new Set([
  "canary",
  "tree",
  "index",
  "export",
  "changed",
  "history",
  "artifact",
]);
export async function runRepositorySecretScan({
  mode,
  target,
  repositoryRoot = REPOSITORY_ROOT,
  configPath = join(repositoryRoot, ".betterleaks.toml"),
  installVerifier = verifyBetterleaksInstall,
} = {}) {
  if (
    !modes.has(mode) ||
    (["changed", "artifact"].includes(mode) && !target) ||
    (!["export", "changed", "artifact"].includes(mode) && target)
  ) {
    throw new SecretScanError(
      "SECRET_SCAN_ARGUMENTS",
      "choose a documented scope and its required source selection",
    );
  }
  const installation = await installVerifier({ repositoryRoot });
  const configSha256 = createHash("sha256")
    .update(await readFile(configPath))
    .digest("hex");
  const binaryPath = installation.binaryPath;
  const canary = await runSyntheticCanary({ binaryPath, configPath });
  const receipt = {
    version: installation.version,
    configSha256,
    canary,
    scopes: [],
  };
  if (mode === "canary") return receipt;
  let snapshot,
    removeSnapshot = false,
    identity = {},
    args,
    cwd = repositoryRoot;
  const scopes = {
    tree: "tracked working files",
    index: "exact proposed index",
    export: "committed source export",
    changed: "changed committed source",
    history: "diff-visible local-ref history",
    artifact: "named artifact",
  };
  try {
    if (mode === "history") {
      assertCompleteHistoryAvailable(repositoryRoot);
      // Current ignore surfaces cannot silently suppress historical candidates.
      for (const name of SCANNER_IGNORE_FILENAMES) {
        try {
          await lstat(join(repositoryRoot, name));
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        throw new SecretScanError(
          "SECRET_SCAN_IGNORE",
          "route reviewed exceptions through the scanner configuration",
        );
      }
      const refs = runGit(
        ["for-each-ref", "--format=%(objectname) %(refname)"],
        repositoryRoot,
      );
      if (refs.status !== 0)
        throw new SecretScanError(
          "SECRET_SCAN_REFS",
          "local refs are unavailable",
        );
      identity = {
        refsSha256: createHash("sha256").update(refs.stdout).digest("hex"),
        refCount: refs.stdout.split("\n").filter(Boolean).length,
      };
      args = [
        "git",
        repositoryRoot,
        "--log-opts=--all --full-history --diff-merges=separate --diff-filter=tuxdb",
      ];
    } else {
      if (mode === "artifact") {
        const artifact = await resolveArtifactTarget(target, repositoryRoot);
        if ((await lstat(artifact)).isFile()) {
          if (!artifact.toLowerCase().endsWith(".zip"))
            throw new SecretScanError(
              "SECRET_SCAN_ARTIFACT",
              "select a generated directory or ordinary source ZIP",
            );
          const extracted = await materializeZip(artifact);
          snapshot = extracted.root;
          identity.archiveSha256 = extracted.archiveSha256;
        } else snapshot = await materializeDirectory(artifact);
        removeSnapshot = true;
      } else {
        let entries;
        if (mode === "export" || mode === "changed") {
          const source = committedEntries(
            repositoryRoot,
            mode === "export" ? (target ?? "HEAD") : "HEAD",
            mode === "changed" ? target : undefined,
          );
          entries = source.entries;
          identity.commit = source.commit;
        } else entries = inspectIndex(repositoryRoot);
        snapshot = await materializeEntries(
          entries,
          repositoryRoot,
          mode === "tree",
        );
        removeSnapshot = true;
      }
      await assertSingleSuppressionSurface(snapshot);
      identity = { ...identity, ...(await snapshotIdentity(snapshot)) };
      cwd = snapshot;
      args = ["dir", "."];
    }
    const scope = scopes[mode];
    const result = await executeSecretScan({
      binaryPath,
      configPath,
      cwd,
      scannerArguments: args,
      scope,
    });
    if (result.findings.length)
      throw new SecretScanFindingsError(scope, result.findings);
    receipt.scopes.push({ scope, status: "clean", ...identity });
    return receipt;
  } finally {
    if (removeSnapshot && snapshot)
      await rm(snapshot, { recursive: true, force: true });
  }
}

export function renderReceipt(receipt) {
  return JSON.stringify(receipt) + "\n";
}
export function renderFindings(error) {
  const rules = {};
  for (const finding of error.findings)
    rules[finding.rule] = (rules[finding.rule] ?? 0) + 1;
  return (
    JSON.stringify({
      status: "findings",
      scope: error.scope,
      count: error.findings.length,
      rules,
      next: "Pause publication and inspect candidates privately; raw paths and values remain outside this receipt.",
    }) + "\n"
  );
}
if (isDirectExecution(import.meta.url)) {
  const [mode, target, ...extra] = process.argv.slice(2);
  if (mode === "--help") {
    console.log(
      "Usage: node scripts/security/scan-secret-material.mjs canary|tree|index|export [revision]|changed <base>|history|artifact <directory-or-zip>",
    );
  } else {
    Promise.resolve()
      .then(() => {
        if (extra.length)
          throw new SecretScanError(
            "SECRET_SCAN_ARGUMENTS",
            "choose one scope and selection",
          );
        return runRepositorySecretScan({ mode, target });
      })
      .then((receipt) => process.stdout.write(renderReceipt(receipt)))
      .catch((error) => {
        process.stderr.write(
          error instanceof SecretScanFindingsError
            ? renderFindings(error)
            : "Publication scan did not complete. Confirm the pinned install, source scope and supported file boundaries; diagnostics remain private.\n",
        );
        process.exitCode = 1;
      });
  }
}
