import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createMarkdownRenderer } from "../scripts/documentation/render.mjs";
import {
  assertBuildDirectory,
  loadManifest,
  readOwnedFile,
  validateManifest,
} from "../scripts/documentation/manifest.mjs";
import { buildDocumentationSite } from "../scripts/documentation/build.mjs";
import { graphqlReference } from "../scripts/documentation/reference.mjs";
import { buildSchema } from "graphql";
import { createOperationRegistry } from "../server/graphql/operations.mjs";
import { createWorkspaceOperationRegistry } from "../server/workspaces/operations.mjs";
import { documentationRoutes } from "../server/security/documentation-routes.mjs";
import { runningServer } from "./server-fixture.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "docs-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};

test("Markdown remains inert and links only to admitted destinations", () => {
  const renderer = createMarkdownRenderer({
    articles: [
      { slug: "", source: "docs/home.md" },
      { slug: "guide", source: "docs/guide.md" },
    ],
    documents: [{ path: "docs/other.md" }],
    base: "/docs/",
    source: "docs/home.md",
  });
  const html = renderer.render(
    "# Example\n\n<script>window.pwned=1</script>\n\n[Guide](guide.md#start) [Other](other.md) [Source](../server/private.mjs) [Bad](javascript:alert(1)) [Data](data:text/html,test) [Credentials](https://user:pass@example.invalid/)\n\n```html\n<img src=x onerror=alert(1)>\n```",
  );
  assert.doesNotMatch(
    html,
    /<script|<img|href="(?:javascript:|data:|https:\/\/user:pass)/,
  );
  assert.match(html, /href="\/docs\/guide\/#start"/);
  assert.doesNotMatch(html, /href="[^"]*llms-full/);
  assert.doesNotMatch(html, /href="[^\"]*private.mjs/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(renderer.references.has("server/private.mjs"));
});

test("manifest and source admission reject duplicate routes and symlinks", async (t) => {
  const manifest = await loadManifest(root);
  assert.throws(() =>
    validateManifest({
      ...manifest,
      articles: [...manifest.articles, manifest.articles[0]],
    }),
  );
  assert.throws(() =>
    validateManifest({
      ...manifest,
      profiles: {
        ...manifest.profiles,
        app: { ...manifest.profiles.app, output: "src" },
      },
    }),
  );
  const dir = await temporary(t);
  await symlink(join(root, "README.md"), join(dir, "linked.md"));
  await assert.rejects(readOwnedFile(dir, "linked.md"));
  await assert.rejects(readOwnedFile(dir, "../README.md"));
  await symlink(root, join(dir, "output"));
  await assert.rejects(assertBuildDirectory(dir, "output/docs"));
  await mkdir(join(dir, "docs"));
  await writeFile(
    join(dir, "docs/routes.json"),
    JSON.stringify({
      version: 1,
      routes: [{ route: "/docs/", file: "index.html" }],
    }),
  );
  await symlink(join(root, "README.md"), join(dir, "docs/index.html"));
  await assert.rejects(documentationRoutes(dir));
});

test("schema reference agrees with both registered operation owners", async () => {
  const reference = await graphqlReference(root);
  for (const [owner, registry] of [
    ["graphql", createOperationRegistry],
    ["workspaces", createWorkspaceOperationRegistry],
  ]) {
    const source = await readFile(
      join(root, `server/${owner}/schema.graphql`),
      "utf8",
    );
    for (const operation of registry(buildSchema(source)).operations) {
      assert.ok(reference.includes(operation.name));
      assert.ok(reference.includes(operation.sha256Hash));
      assert.ok(
        reference.includes(
          (
            await readFile(
              join(
                root,
                `server/${owner}/operations/${operation.name}.graphql`,
              ),
              "utf8",
            )
          ).trimEnd(),
        ),
      );
    }
  }
});

test("both production profiles have ordinary links, metadata and isolated assets", async () => {
  await buildDocumentationSite({ root, profile: "foundation" });
  const manifest = await loadManifest(root);
  for (const [directory, base, origin] of [
    ["dist/docs", "/docs/", "https://kindlight.ai"],
    ["dist-foundation", "/", "https://kindlight.foundation"],
  ]) {
    for (const article of manifest.articles) {
      const html = await readFile(
          join(root, directory, article.slug, "index.html"),
          "utf8",
        ),
        route = base + (article.slug ? `${article.slug}/` : "");
      assert.ok(html.includes(`href="${origin}${route}"`));
      assert.match(html, /data-documentation-entry/);
      assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
      assert.ok(html.includes(`href="${base}llms.txt"`));
      assert.match(html, new RegExp(`src="${base}assets/`));
      assert.doesNotMatch(html, /initial-load-bootstrap/);
    }
    const graph = JSON.parse(
      await readFile(join(root, directory, "module-graph.json"), "utf8"),
    );
    assert.ok(graph.sources.includes("src/app/theme/ThemeProvider.tsx"));
    assert.ok(graph.sources.includes("src/documentation/main.tsx"));
    assert.ok(
      graph.sources.every((path) =>
        /^src\/(documentation\/|app\/theme\/|styles\/fonts\.css)/.test(path),
      ),
    );
    const files = JSON.parse(
      await readFile(join(root, directory, ".vite/manifest.json"), "utf8"),
    );
    const assets = Object.values(files).map((entry) => entry.file);
    assert.ok(assets.length > 0);
    for (const asset of assets) {
      const code = await readFile(join(root, directory, asset), "utf8");
      assert.doesNotMatch(
        code,
        /DesktopWorkspace|MobilePlate|BrowserSessionProvider|Cross-source synthesis/,
      );
    }
    const llms = await readFile(join(root, directory, "llms-full.txt"), "utf8");
    assert.match(llms, /GraphQL reference/);
    assert.match(llms, /type Query/);
  }
});

test("explicit build and ordinary production entry serve exact docs routes with policy and meaningful 404s", async (t) => {
  const base = await runningServer(t, { buildFirst: true, waitMs: 10000 });
  const page = await fetch(`${base}/docs/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-documentation-entry/);
  assert.equal(page.headers.get("cache-control"), "no-cache");
  assert.match(
    page.headers.get("content-security-policy"),
    /script-src 'self';/,
  );
  const redirect = await fetch(`${base}/docs`, { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/docs/");
  assert.equal(
    (
      await fetch(`${base}/docs/index.html`, { redirect: "manual" })
    ).headers.get("location"),
    "/docs/",
  );
  assert.equal((await fetch(`${base}/docs/`, { method: "HEAD" })).status, 200);
  assert.equal((await fetch(`${base}/docs/missing/`)).status, 404);
  assert.equal((await fetch(`${base}/docs/`, { method: "POST" })).status, 405);
  assert.equal(
    (
      await fetch(`${base}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ dataSource { mode } }" }),
      })
    ).status,
    400,
  );
});
