import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  buildDocumentationBundle,
  collectDocumentation,
  documentAnchor,
  renderDocumentation,
} from "../scripts/documentation-bundle.mjs";

async function fixture(t, files) {
  const root = await mkdtemp(join(tmpdir(), "sot-documents-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, contents] of Object.entries({
    "docs/content-manifest.json": JSON.stringify({
      version: 1,
      profiles: {
        app: { base: "/docs/", output: "dist/docs" },
        foundation: { base: "/", output: "dist-foundation" },
      },
      llm: {
        rootMarkdown: true,
        license: true,
        roots: ["docs", "guidelines", ".agents/skills"],
      },
      articles: [
        {
          slug: "",
          source: "README.md",
          title: "Fixture",
          description: "Fixture",
          group: "Start",
        },
      ],
    }),
    ".figma/make/site.json": JSON.stringify({
      title: "Source documentation fixture",
      url: "https://example.invalid",
    }),
    ...files,
  })) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

test("bundles the complete recursive document population in stable order without Git or generated inputs", async (t) => {
  const documents = {
    "README.md": "# Showcase\n\nRoot material.\n",
    "AGENTS.md": "# Repository guidance\n\nPreserved guidance.\n",
    LICENSE: "Copyright fixture\n\nComplete license terms.\n",
    "docs/zeta.md": "# Zeta\n\nLast document.\n",
    "docs/new/nested.md":
      "# Newly added documentation\n\nIncluded automatically.\n",
    "guidelines/Guidelines.md":
      "<!--\n# Authored template\nPreserve this comment.\n-->\n",
    ".agents/skills/example/SKILL.md":
      "---\nname: fixture\n---\n# Example\n\nOwned skill.\n",
  };
  const root = await fixture(t, {
    ...documents,
    "docs/.env-note.md": "Excluded environment file.",
    "docs/.cache/README.md": "Excluded cache.",
    "docs/node_modules/dependency/README.md": "Excluded installed dependency.",
    "dist/generated.md": "Excluded build output.",
    "build/README.md": "Excluded generated output.",
    "node_modules/example/README.md": "Excluded dependency.",
    "src/internal.md": "Outside the declared document roots.",
  });
  const first = await buildDocumentationBundle({ root });
  const expected = Object.keys(documents).sort();
  assert.deepEqual(first.documents, expected);
  const files = ["llms.txt", "llms-full.txt"];
  const before = await Promise.all(
    files.map((name) => readFile(join(root, "dist", name), "utf8")),
  );
  for (const [path, text] of Object.entries(documents)) {
    assert.ok(
      before[1].includes(text),
      `${path} retains its complete authored contents`,
    );
    assert.ok(
      before[0].includes(
        `https://example.invalid/llms-full.txt#${documentAnchor(path)}`,
      ),
    );
  }
  assert.ok(!before[1].includes("Excluded"));
  assert.ok(!before[1].includes("Outside the declared"));
  await buildDocumentationBundle({ root });
  const after = await Promise.all(
    files.map((name) => readFile(join(root, "dist", name), "utf8")),
  );
  assert.deepEqual(
    after,
    before,
    "repeated builds replace outputs with identical bytes",
  );
  assert.equal(first.bytes.index, Buffer.byteLength(before[0]));
  assert.equal(first.bytes.full, Buffer.byteLength(before[1]));
});

test("links document entries and repository references without rewriting authored code or external destinations", () => {
  const code =
    "```md\n[Sample](docs/guide.md)\n```\n`[Inline](docs/guide.md)`\n";
  const { full, index } = renderDocumentation({
    site: { title: "Fixture", url: "https://example.invalid" },
    documents: [
      {
        path: "docs/guide.md",
        text: "# Guide\n\n[Home](../README.md#start)\n[Code](../src/app.ts#example)\n[Same file](#details)\n",
      },
      { path: "docs/with space.md", text: "# Space\n" },
      { path: "docs/flow(plan).md", text: "# Parentheses\n" },
      {
        path: "README.md",
        text: `# Root\n\n[Guide](docs/guide.md)\n[Spaced](<docs/with space.md>)\n[Plan](docs/flow(plan).md)\n[Reference][guide]\n[guide]: docs/guide.md \"Guide title\"\n[External](https://example.org/spec#part)\n${code}`,
      },
      { path: "CLAUDE.md", text: "@AGENTS.md\n" },
    ],
  });
  assert.ok(full.includes(`[Home](#${documentAnchor("README.md")})`));
  assert.ok(full.includes(`[Same file](#${documentAnchor("docs/guide.md")})`));
  assert.ok(
    full.includes(`[Spaced](<#${documentAnchor("docs/with space.md")}>)`),
  );
  assert.ok(full.includes(`[Plan](#${documentAnchor("docs/flow(plan).md")})`));
  assert.ok(
    full.includes(`[guide]: #${documentAnchor("docs/guide.md")} "Guide title"`),
  );
  assert.ok(full.includes("[External](https://example.org/spec#part)"));
  assert.ok(full.includes(code));
  assert.ok(full.includes("@AGENTS.md\n"));
  assert.ok(full.includes("Repository reference: `src/app.ts#example`"));
  assert.match(full, /\[Code\]\(#source-[a-f0-9]+\)/);
  assert.ok(!full.includes("https://example.invalid/src/app.ts"));
  assert.ok(index.includes("grants no runtime permissions"));
  assert.ok(full.includes("not public application routes"));
});

test("refuses symlinked documents, nested directories and documentation roots", async (t) => {
  for (const path of ["README.md", "docs/linked", ".agents"]) {
    await t.test(path, async (t) => {
      const root = await fixture(t, {
        "fixture.md": "Synthetic link target.\n",
      });
      await mkdir(dirname(join(root, path)), { recursive: true });
      await symlink(join(root, "fixture.md"), join(root, path));
      await assert.rejects(
        collectDocumentation(root),
        /symlink|root must stay/,
      );
    });
  }
});
