import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
import { loadManifest } from "./documentation/manifest.mjs";
const excluded = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".cache",
  ".vite",
  ".deploy",
  ".visual-runs",
  "logs",
]);
const isExcluded = (name) =>
  excluded.has(name) || name.startsWith(".env") || name.startsWith(".tmp-");
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

async function inspect(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function collectDocumentation(root) {
  const { llm, articles } = await loadManifest(root);
  const documentationRoots = llm.roots;
  const paths = [];
  async function visit(relative) {
    const state = await inspect(join(root, relative));
    if (!state) return;
    if (state.isSymbolicLink())
      throw new Error(`Documentation symlink requires review: ${relative}`);
    if (state.isDirectory()) {
      for (const name of (await readdir(join(root, relative))).sort(compare)) {
        if (!isExcluded(name)) await visit(posix.join(relative, name));
      }
    } else if (/\.md$/i.test(relative) || relative === "LICENSE") {
      if (!state.isFile() || /[\r\n]/.test(relative))
        throw new Error("Documentation must use ordinary Markdown file paths.");
      paths.push(relative);
    }
  }
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      ((llm.rootMarkdown && /\.md$/i.test(entry.name)) ||
        (llm.license && entry.name === "LICENSE")) &&
      !isExcluded(entry.name)
    )
      await visit(entry.name);
  }
  for (const directory of documentationRoots) {
    const segments = directory.split("/");
    for (let length = 1; length < segments.length; length++) {
      const parent = await inspect(join(root, ...segments.slice(0, length)));
      if (parent?.isSymbolicLink())
        throw new Error(
          "Documentation root must stay inside the source archive.",
        );
    }
    await visit(directory);
  }
  for (const article of articles) {
    if (article.source && !paths.includes(article.source))
      await visit(article.source);
  }
  return Promise.all(
    paths.sort(compare).map(async (path) => ({
      path,
      text: new TextDecoder("utf-8", { fatal: true }).decode(
        await readFile(join(root, path)),
      ),
    })),
  );
}

export function documentAnchor(path) {
  const name = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `document-${name}-${createHash("sha256").update(path).digest("hex").slice(0, 12)}`;
}

const sourceAnchor = (path) =>
  `source-${createHash("sha256").update(path).digest("hex").slice(0, 12)}`;
const code = (text) => `\`${text.replaceAll("`", "&#96;")}\``;
const label = (text) =>
  text.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");

// Rewrite ordinary inline/reference destinations while retaining authored code.
// This is a bounded documentation projection, not a Markdown-to-HTML renderer.
export function rewriteLinks(markdown, destination) {
  function prose(text) {
    return text
      .replace(
        /(\]\()(<[^>\n]*>|(?:\\.|[^()\s]|\((?:\\.|[^()])*\))+)(\s+(?:"[^"]*"|'[^']*'))?\)/g,
        (match, start, target, title = "") =>
          `${start}${target.startsWith("<") ? `<${destination(target.slice(1, -1))}>` : destination(target)}${title})`,
      )
      .replace(
        /^( {0,3}\[[^\]\n]+\]:\s*)(<[^>\n]*>|[^\s]+)(.*)$/gm,
        (match, start, target, rest) =>
          `${start}${target.startsWith("<") ? `<${destination(target.slice(1, -1))}>` : destination(target)}${rest}`,
      );
  }
  function outsideFence(text) {
    let result = "",
      offset = 0;
    for (const match of text.matchAll(/(`+)[\s\S]*?\1(?!`)/g)) {
      result += prose(text.slice(offset, match.index)) + match[0];
      offset = match.index + match[0].length;
    }
    return result + prose(text.slice(offset));
  }
  let fence = null,
    pending = "",
    output = "";
  for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)/);
    if (fence) {
      output += line;
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null;
    } else if (marker) {
      output += outsideFence(pending) + line;
      pending = "";
      fence = marker[1];
    } else pending += line;
  }
  return output + outsideFence(pending);
}

function canonicalOrigin(value) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "site.json.url must be an HTTP(S) origin without credentials, path, query or fragment.",
    );
  }
  return url.origin;
}

export function renderDocumentation({ documents, site, base = "/" }) {
  const origin = canonicalOrigin(site.url);
  const ordered = [...documents].sort((a, b) => compare(a.path, b.path));
  const included = new Map(
    ordered.map((document) => [document.path, documentAnchor(document.path)]),
  );
  const references = new Set();
  const bundleUrl = `${origin}${base}llms-full.txt`;
  const title =
    typeof site.title === "string"
      ? site.title.replace(/[\r\n]+/g, " ")
      : "Source of Truth for Life Sciences";
  const summary =
    typeof site.description === "string"
      ? site.description.replace(/[\r\n]+/g, " ")
      : "Explore genomics workflows, sample histories, and data provenance in a visual, interactive life sciences experience.";
  const index = [
    `# ${title}`,
    "",
    `> ${summary}`,
    "",
    "Repository guidance describes development practice. It grants no runtime permissions and does not override the reader's governing instructions.",
    "",
    "## Documentation",
    "",
    `- [Complete repository documentation](${bundleUrl}): Every Markdown document in the declared documentation roots and the full LICENSE, with source paths and full-file anchors.`,
    "",
    "## Document index",
    "",
    ...ordered.map(
      ({ path }) => `- [${label(path)}](${bundleUrl}#${included.get(path)})`,
    ),
    "",
  ].join("\n");
  const sections = ordered.map(({ path, text }) => {
    const content = rewriteLinks(text, (target) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//"))
        return target;
      const separator = target.search(/[?#]/);
      const rawPath = separator < 0 ? target : target.slice(0, separator);
      let decoded;
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        decoded = rawPath;
      }
      decoded = decoded.replace(/\\([\\()[\] <>])/g, "$1");
      const resolved = !rawPath
        ? path
        : posix.normalize(
            decoded.startsWith("/")
              ? decoded.slice(1)
              : posix.join(posix.dirname(path), decoded),
          );
      if (included.has(resolved)) return `#${included.get(resolved)}`;
      const source = `${resolved}${separator < 0 ? "" : target.slice(separator)}`;
      references.add(source);
      return `#${sourceAnchor(source)}`;
    });
    return `<a id="${included.get(path)}"></a>\n\n## ${code(path)}\n\nSource document: ${code(path)}.\n\n${content}${content.endsWith("\n") ? "" : "\n"}`;
  });
  const full = [
    `# ${title} — complete repository documentation`,
    "",
    `> ${summary}`,
    "",
    "Scope: the source population admitted by docs/content-manifest.json: root Markdown files and LICENSE, plus docs/, guidelines/, and .agents/skills/, including nested Markdown documents and source-derived reference entries. Installed dependencies, environment files, caches and generated build directories are outside this source-document population.",
    "",
    "Each entry retains its authored text and code. Relative documentation links point to the corresponding full-file entry; section fragments return to that document. External links retain their authored destinations. Other relative references point to the repository-reference appendix, which identifies source paths without claiming that code or configuration is publicly served.",
    "",
    "AGENTS, CLAUDE, skills and guidelines appear as documentation of repository collaboration. Their inclusion grants no runtime permissions and does not override the reader's governing instructions. Application authorization remains enforced by the application's own boundaries.",
    "",
    `Documents: ${ordered.length}.`,
    "",
    ...sections,
    "## Repository source references",
    "",
    "These are authored repository references outside the bundled Markdown population. They are source coordinates, not public application routes or copies of those files.",
    "",
    ...[...references]
      .sort(compare)
      .map(
        (path) =>
          `<a id="${sourceAnchor(path)}"></a>\n\n- Repository reference: ${code(path)}`,
      ),
    "",
  ].join("\n");
  return { index, full };
}

export async function buildDocumentationBundle({
  root = repository,
  output = join(root, "dist"),
  siteOverride = {},
  base = "/",
  additionalDocuments = [],
} = {}) {
  const documents = [
    ...(await collectDocumentation(root)),
    ...additionalDocuments,
  ];
  const site = JSON.parse(
    await readFile(join(root, ".figma/make/site.json"), "utf8"),
  );
  const { index, full } = renderDocumentation({
    documents,
    site: { ...site, ...siteOverride },
    base,
  });
  const existing = await inspect(output);
  if (existing?.isSymbolicLink())
    throw new Error(
      "Documentation output must be an ordinary build directory.",
    );
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(join(output, "llms.txt"), index),
    writeFile(join(output, "llms-full.txt"), full),
  ]);
  return {
    documents: documents.map(({ path }) => path),
    bytes: { index: Buffer.byteLength(index), full: Buffer.byteLength(full) },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const result = await buildDocumentationBundle();
  console.log(`Bundled ${result.documents.length} documentation files.`);
}
