import { readFile, lstat } from "node:fs/promises";
import { join, posix } from "node:path";
export const MANIFEST_PATH = "docs/content-manifest.json";
export function sourcePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\\\x00-\x1f:#?]/.test(value) &&
    !value.startsWith("/") &&
    value.split("/").every((part) => part && part !== "." && part !== "..")
  );
}
export async function readOwnedFile(root, path) {
  if (!sourcePath(path))
    throw new Error("Documentation source requires a contained ordinary path.");
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const state = await lstat(join(root, ...parts.slice(0, i)));
    if (
      state.isSymbolicLink() ||
      !(i === parts.length ? state.isFile() : state.isDirectory())
    )
      throw new Error(
        "Documentation source requires ordinary files and directories.",
      );
  }
  return readFile(join(root, path), "utf8");
}
export function validateManifest(value) {
  if (
    value.version !== 1 ||
    !Array.isArray(value.articles) ||
    !value.articles.length ||
    !Array.isArray(value.llm?.roots)
  )
    throw new Error("Documentation manifest is incomplete.");
  const slugs = new Set(),
    sources = new Set();
  for (const article of value.articles) {
    if (
      typeof article.slug !== "string" ||
      (article.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) ||
      slugs.has(article.slug) ||
      ![article.title, article.description, article.group].every(
        (item) => typeof item === "string" && item.trim(),
      )
    )
      throw new Error(
        "Documentation routes need unique slugs and reader metadata.",
      );
    slugs.add(article.slug);
    if (article.generated) {
      if (article.generated !== "graphql" || article.source)
        throw new Error("Unknown generated documentation owner.");
    } else {
      if (!sourcePath(article.source) || sources.has(article.source))
        throw new Error("Documentation sources must be unique ordinary paths.");
      sources.add(article.source);
    }
  }
  if (!slugs.has("") || !value.llm.roots.every(sourcePath))
    throw new Error(
      "Documentation needs a home and contained LLM source roots.",
    );
  for (const name of ["app", "foundation"]) {
    const profile = value.profiles?.[name];
    if (
      !profile ||
      profile.base !== (name === "app" ? "/docs/" : "/") ||
      profile.output !== (name === "app" ? "dist/docs" : "dist-foundation")
    )
      throw new Error(
        "Documentation profile needs an explicit base and output.",
      );
  }
  return value;
}
export const loadManifest = async (root) =>
  validateManifest(JSON.parse(await readOwnedFile(root, MANIFEST_PATH)));
export function origin(value) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Documentation origin must be an ordinary HTTP(S) origin.");
  return url.origin;
}
export const articleRoute = (base, slug) => `${base}${slug ? `${slug}/` : ""}`;
export const articleSource = (article) =>
  article.source ?? `docs/site/${article.slug}.md`;
export const resolveSource = (from, target) =>
  posix.normalize(
    target.startsWith("/")
      ? target.slice(1)
      : posix.join(posix.dirname(from), target),
  );

export async function assertBuildDirectory(root, path) {
  if (!sourcePath(path))
    throw new Error(
      "Documentation output requires a contained generated directory.",
    );
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    let state;
    try {
      state = await lstat(join(root, ...parts.slice(0, i)));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (state.isSymbolicLink() || !state.isDirectory())
      throw new Error(
        "Documentation output crosses a symlink or ordinary file.",
      );
  }
}
