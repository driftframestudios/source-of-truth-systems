import { execFileSync } from "node:child_process";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const documentPath = (path) =>
  /\.md$/i.test(path) ||
  path === "LICENSE" ||
  path === "docs/content-manifest.json";

/** Unknown owners receive Core; documentation is a positive, finite route. */
export function selectVerification(paths, { full = false } = {}) {
  if (
    !Array.isArray(paths) ||
    paths.some(
      (path) =>
        typeof path !== "string" ||
        !path ||
        path.startsWith("/") ||
        path.includes("\0") ||
        path.split("/").includes(".."),
    )
  )
    throw new Error("Select repository-relative changed paths.");
  const docs = !full && paths.length > 0 && paths.every(documentPath);
  return {
    version: 1,
    route: docs ? "docs" : "core",
    changedFiles: paths.length,
    reason: docs
      ? "Documentation source changed; build and exercise its two publication profiles."
      : "Application, configuration, an unclassified owner or the full-source route requires Core.",
    scan: "committed-tree",
  };
}

/** A selected observation succeeds only when every required step really ran. */
export function verifyOutcomes(selection, outcomes) {
  if (
    selection?.version !== 1 ||
    !["docs", "core"].includes(selection.route) ||
    selection.scan !== "committed-tree"
  )
    throw new Error("Verification selection is missing or unsupported.");
  for (const name of [
    "prepare",
    "selection",
    "build",
    "checks",
    "scan",
    "identity",
  ])
    if (outcomes[name] !== "success")
      throw new Error(`Required ${name} observation did not pass.`);
  for (const name of ["types", "geometry"]) {
    const expected = selection.route === "core" ? "success" : "skipped";
    if (outcomes[name] !== expected)
      throw new Error(
        `${name} outcome does not match the selected ${selection.route} route.`,
      );
  }
  return true;
}

export function changedPaths(base, head = "HEAD") {
  if (!COMMIT.test(base))
    throw new Error("Choose an available full base commit SHA.");
  git("cat-file", "-e", `${base}^{commit}`);
  // Include both sides of a rename: deleting code and adding Markdown still owns code.
  return execFileSync(
    "git",
    ["diff", "--no-renames", "--name-only", "-z", base, head, "--"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
    .split("\0")
    .filter(Boolean);
}

async function main(mode) {
  const destination = process.env.VERIFICATION_SELECTION;
  if (!destination)
    throw new Error("Name the invocation-owned verification selection file.");
  if (mode === "select") {
    const base = process.env.BASE_COMMIT || "";
    const selection = {
      ...selectVerification(base ? changedPaths(base) : [], { full: !base }),
      head: git("rev-parse", "HEAD"),
      base: base || null,
    };
    await writeFile(destination, `${JSON.stringify(selection)}\n`, {
      flag: "wx",
    });
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `route=${selection.route}\n`);
    console.log(`Selected ${selection.route}: ${selection.reason}`);
  } else if (mode === "finish") {
    const selection = JSON.parse(await readFile(destination, "utf8"));
    if (
      !COMMIT.test(selection.head) ||
      selection.head !== git("rev-parse", "HEAD")
    )
      throw new Error("Verification source identity changed.");
    verifyOutcomes(
      selection,
      JSON.parse(process.env.VERIFICATION_OUTCOMES || "{}"),
    );
    const receipt = `Verified ${selection.route} at ${selection.head}. Selected checks and the current committed-tree publication scan passed.\nFull browser, actual-engine, receiving-clone and hosted acceptance remain their separately selected observations.\n`;
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, receipt);
    console.log(receipt);
  } else
    throw new Error("Use select or finish for this verification invocation.");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
