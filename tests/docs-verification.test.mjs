import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  DOCUMENTATION_POLICY,
  verifyDocumentation,
} from "../scripts/ci/verify-docs.mjs";
import { documentationWrapper } from "../scripts/ci/create-docs-wrapper.mjs";

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "sot-docs-proof-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = join(root, "candidate"),
    output = join(root, "snapshot");
  await mkdir(repository);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q");
  git("config", "user.name", "Documentation fixture");
  git("config", "user.email", "fixture@example.invalid");
  const put = async (path, bytes) => {
    await mkdir(dirname(join(repository, path)), { recursive: true });
    await writeFile(join(repository, path), bytes);
  };
  await put("CNAME", "kindlight.foundation");
  await put("LICENSE", "Reviewed fixture license\n");
  await put(
    "README.md",
    "# Publication\n\n[Image](media/plate.png) [Reference][plate]\n\n[plate]: media/plate.png\n\n`[Code](missing.md)`\n\n```md\n[Example](missing.md)\n```\n",
  );
  await put("media/plate.png", Buffer.from([137, 80, 78, 71]));
  await put(
    "display.js",
    'throw new Error("Candidate code must remain inert");\n',
  );
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "-qm",
      "Reviewed documentation",
    );
    return git("rev-parse", "HEAD");
  };
  const initial = commit(),
    policy = {
      ...DOCUMENTATION_POLICY,
      licenseObject: git("rev-parse", `${initial}:LICENSE`),
    };
  return { root, repository, output, git, put, commit, policy, initial };
}

test("trusted documentation checks read candidate code as data and retain exact media/license", async (t) => {
  const f = await fixture(t);
  const result = await verifyDocumentation({ ...f, commit: f.initial });
  assert.equal(result.files, 5);
  assert.equal(result.checkedLinks, 2);
  assert.equal(result.mediaFiles, 1);
  assert.equal(
    await readFile(join(f.output, "display.js"), "utf8"),
    'throw new Error("Candidate code must remain inert");\n',
  );
  assert.deepEqual(
    await readFile(join(f.output, "media/plate.png")),
    Buffer.from([137, 80, 78, 71]),
  );
  await assert.rejects(readFile(join(f.output, ".git/config")), {
    code: "ENOENT",
  });
});

test("domain, retained license, missing destinations and tree escapes refuse publication data", async (t) => {
  const f = await fixture(t);
  for (const [path, value] of [
    ["CNAME", "other.example"],
    ["LICENSE", "Changed ownership\n"],
    ["README.md", "[Missing](absent.html)\n"],
    ["README.md", "[Outside](../outside.md)\n"],
    [
      "README.md",
      '<a href="javascript:alert(1)">link</a>\n[Unsafe](javascript:alert(1))\n',
    ],
  ]) {
    f.git("reset", "--hard", f.initial);
    await f.put(path, value);
    await assert.rejects(verifyDocumentation({ ...f, commit: f.commit() }));
    await assert.rejects(readFile(join(f.output, "CNAME")), { code: "ENOENT" });
  }
});

test("application owners, links and media-budget overruns stay outside the docs profile", async (t) => {
  const f = await fixture(t);
  await f.put("package.json", '{"scripts":{"install":"arbitrary"}}');
  await assert.rejects(
    verifyDocumentation({ ...f, commit: f.commit() }),
    /application and dependency/,
  );
  f.git("reset", "--hard", f.initial);
  await symlink("README.md", join(f.repository, "linked.md"));
  await assert.rejects(
    verifyDocumentation({ ...f, commit: f.commit() }),
    /ordinary non-executable/,
  );
  await assert.rejects(
    verifyDocumentation({
      ...f,
      commit: f.initial,
      policy: { ...f.policy, maxFileBytes: 1 },
    }),
    /media budget/,
  );
  await assert.rejects(
    verifyDocumentation({ ...f, commit: "HEAD" }),
    /explicit full/,
  );
});

test("the generated docs wrapper pins trusted main tooling and carries no deployment or candidate execution", () => {
  const sha = "8".repeat(40),
    wrapper = documentationWrapper(sha);
  assert.match(
    wrapper,
    new RegExp(
      `uses: driftframestudios/source-of-truth-systems/\\.github/actions/verify-docs@${sha}`,
    ),
  );
  assert.match(wrapper, /branches: \[docs\]/);
  assert.match(wrapper, /contents: read/);
  assert.doesNotMatch(
    wrapper,
    /pull_request_target|run:|pages:|id-token:|secrets:|workflow_dispatch/,
  );
  for (const value of ["main", "abc123", "x\nrun: malicious", ""])
    assert.throws(() => documentationWrapper(value));
});
