import { spawnSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertBuildDirectory,
  loadManifest,
  readOwnedFile,
  articleRoute,
  origin,
} from "./manifest.mjs";
import { renderPage } from "./render.mjs";
import { graphqlReference } from "./reference.mjs";
import { buildDocumentationBundle } from "../documentation-bundle.mjs";
const repository = fileURLToPath(new URL("../../", import.meta.url));
export async function prepareDocumentation({
  root = repository,
  profile = "app",
} = {}) {
  const manifest = await loadManifest(root),
    settings = manifest.profiles[profile];
  if (!settings)
    throw new Error("Choose app or foundation documentation profile.");
  const site = JSON.parse(await readOwnedFile(root, ".figma/make/site.json"));
  const docsOrigin = origin(
      settings.origin === "site" ? site.url : settings.origin,
    ),
    appUrl = origin(site.url);
  const input = join(root, ".docs-build", profile),
    output = join(root, settings.output);
  await assertBuildDirectory(root, `.docs-build/${profile}`);
  await assertBuildDirectory(root, settings.output);
  await rm(input, { recursive: true, force: true });
  await mkdir(input, { recursive: true });
  const routes = [],
    generatedDocuments = [];
  for (const article of manifest.articles) {
    const target = join(input, article.slug, "index.html");
    await mkdir(dirname(target), { recursive: true });
    const entry = relative(
      dirname(target),
      join(root, "src/documentation/main.tsx"),
    )
      .split("\\")
      .join("/");
    const text = article.generated
      ? await graphqlReference(root)
      : await readOwnedFile(root, article.source);
    if (article.generated)
      generatedDocuments.push({ path: `docs/site/${article.slug}.md`, text });
    await writeFile(
      target,
      renderPage({
        article,
        text,
        manifest,
        base: settings.base,
        origin: docsOrigin,
        appUrl,
        entry,
      }),
    );
    routes.push({
      route: articleRoute(settings.base, article.slug),
      file: `${article.slug ? `${article.slug}/` : ""}index.html`,
    });
  }
  await writeFile(
    join(input, "build-settings.json"),
    JSON.stringify({ input, output, base: settings.base, routes }),
  );
  return {
    input,
    output,
    base: settings.base,
    routes,
    origin: docsOrigin,
    generatedDocuments,
  };
}
export async function buildDocumentationSite({
  root = repository,
  profile = "app",
  runBuild,
} = {}) {
  const settings = await prepareDocumentation({ root, profile });
  const build =
    runBuild ??
    (() =>
      spawnSync(
        process.execPath,
        [
          join(root, "node_modules/vite/bin/vite.js"),
          "build",
          "--config",
          "vite.docs.config.mjs",
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            NODE_ENV: "production",
            DOCS_PROFILE: profile,
          },
          stdio: "inherit",
        },
      ));
  const result = build();
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Documentation build failed.");
  await buildDocumentationBundle({
    root,
    output: settings.output,
    siteOverride: { url: settings.origin },
    base: settings.base,
    additionalDocuments: settings.generatedDocuments,
  });
  await writeFile(
    join(settings.output, "routes.json"),
    JSON.stringify({ version: 1, routes: settings.routes }, null, 2),
  );
  if (profile === "foundation") {
    await writeFile(
      join(settings.output, "robots.txt"),
      "User-agent: *\nAllow: /\n",
    );
    await writeFile(
      join(settings.output, "404.html"),
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document not found</title><h1>Document not found</h1><p><a href="/">Return to the documentation</a></p></html>',
    );
  }
  return settings;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await buildDocumentationSite({ profile: process.argv[2] ?? "app" });
