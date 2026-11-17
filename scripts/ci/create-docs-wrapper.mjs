import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function documentationWrapper(trustedCommit) {
  if (!/^[a-f0-9]{40}$/.test(trustedCommit ?? ""))
    throw new Error("Choose an accepted full public-main commit SHA.");
  return `name: Verify documentation
on:
  pull_request:
    branches: [docs]
    types: [opened, synchronize, reopened, ready_for_review, edited]
permissions:
  contents: read
concurrency:
  group: verify-documentation-\${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  verify:
    name: Verify documentation
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
          fetch-depth: 1
      - uses: driftframestudios/source-of-truth-systems/.github/actions/verify-docs@${trustedCommit}
`;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const [commit, destination, ...extra] = process.argv.slice(2);
    if (!destination || extra.length)
      throw new Error(
        "Use create-docs-wrapper.mjs <accepted-public-main-sha> <new-workflow-file>.",
      );
    const content = documentationWrapper(commit);
    execFileSync(
      "git",
      ["cat-file", "-e", `${commit}:.github/actions/verify-docs/action.yml`],
      {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => !key.toUpperCase().startsWith("GIT_"),
            ),
          ),
          GIT_NO_REPLACE_OBJECTS: "1",
        },
      },
    );
    await writeFile(resolve(destination), content, { flag: "wx" });
    console.log(
      "Created the pinned documentation verification wrapper. Git refs and Pages settings remain unchanged.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
