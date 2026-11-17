import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { rewriteLinks } from "../documentation-bundle.mjs";

// The reviewed main notice accompanies the separately approved docs protection PR.
export const DOCUMENTATION_POLICY = Object.freeze({
  domain: "kindlight.foundation",
  licenseObject: "84e69e8cc706bb43ae6fc2b900ffd1c5d61a11a4",
  maxFiles: 2000,
  maxFileBytes: 100_000_000,
  maxTotalBytes: 1_000_000_000,
});
const extensions = new Set([
  ".md",
  ".html",
  ".css",
  ".js",
  ".json",
  ".yml",
  ".yaml",
  ".txt",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".avif",
  ".webp",
  ".gif",
  ".ico",
  ".pdf",
  ".mp4",
  ".webm",
  ".woff",
  ".woff2",
]);
const names = new Set([
  "CNAME",
  "LICENSE",
  ".nojekyll",
  ".gitignore",
  ".github/CODEOWNERS",
]);
const fullSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const git = (repository, ...args) =>
  execFileSync("git", args, {
    cwd: repository,
    maxBuffer: DOCUMENTATION_POLICY.maxFileBytes,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.toUpperCase().startsWith("GIT_"),
        ),
      ),
      GIT_NO_REPLACE_OBJECTS: "1",
    },
  });
function admitPath(path) {
  if (
    /[\\\x00-\x1f\x7f:]/.test(path) ||
    path
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.toLowerCase() === ".git",
      )
  )
    throw new Error("Publication paths must remain ordinary relative files.");
  if (
    /^(?:src|server|node_modules|scripts|tests)\//.test(path) ||
    /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|\.env[^/]*)$/.test(
      path,
    )
  )
    throw new Error(
      "Keep application and dependency owners on main; this branch owns publication data.",
    );
  if (!names.has(path) && !extensions.has(extname(path).toLowerCase()))
    throw new Error(
      "Review this new publication file type before extending its admitted population.",
    );
}
function checkDestination(source, target, paths) {
  if (/^(?:https?:|mailto:)/i.test(target)) return;
  if (target.startsWith("#")) return;
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.startsWith("//") ||
    target.includes("\\")
  )
    throw new Error(
      "Publication links require a relative destination or an ordinary web/contact URL.",
    );
  let pathname;
  try {
    pathname = decodeURIComponent(target.split(/[?#]/, 1)[0]);
  } catch {
    throw new Error("A publication destination has invalid encoding.");
  }
  if (!pathname) return;
  const destination = posix.normalize(
    pathname.startsWith("/")
      ? pathname.slice(1)
      : posix.join(posix.dirname(source), pathname),
  );
  if (
    destination === ".." ||
    destination.startsWith("../") ||
    ![
      destination,
      posix.join(destination, "index.html"),
      posix.join(destination, "README.md"),
    ].some((path) => paths.has(path))
  )
    throw new Error(
      "A relative publication destination is missing or escapes its tree.",
    );
}

/** Read committed documentation as data; the caller supplies a fresh scan snapshot directory. */
export async function verifyDocumentation({
  repository,
  commit,
  output,
  policy = DOCUMENTATION_POLICY,
}) {
  if (
    !fullSha.test(commit ?? "") ||
    git(repository, "cat-file", "-t", commit).toString().trim() !== "commit"
  )
    throw new Error("Verify an explicit full candidate commit.");
  const entries = new Map(),
    folded = new Map();
  let totalBytes = 0;
  for (const line of git(
    repository,
    "ls-tree",
    "-r",
    "-l",
    "-z",
    "--full-tree",
    commit,
  )
    .toString()
    .split("\0")
    .filter(Boolean)) {
    const match = /^100644 blob ([a-f0-9]+)\s+(\d+)\t(.+)$/s.exec(line);
    if (!match)
      throw new Error(
        "Publication data uses ordinary non-executable files; links and submodules require review.",
      );
    const [, object, sizeText, path] = match,
      size = Number(sizeText);
    admitPath(path);
    const parts = path.split("/");
    for (let length = 1; length <= parts.length; length++) {
      const part = parts.slice(0, length).join("/"),
        key = part.toLowerCase();
      if (folded.has(key) && folded.get(key) !== part)
        throw new Error(
          "Publication paths must remain distinct across supported filesystems.",
        );
      folded.set(key, part);
    }
    totalBytes += size;
    if (
      size > policy.maxFileBytes ||
      totalBytes > policy.maxTotalBytes ||
      entries.size >= policy.maxFiles
    )
      throw new Error("Publication exceeds its reviewed file or media budget.");
    entries.set(path, { object, size });
  }
  if (entries.get("LICENSE")?.object !== policy.licenseObject)
    throw new Error(
      "Use the approved receiving LICENSE; changes require an explicit license review.",
    );
  if (
    !entries.has("CNAME") ||
    ![policy.domain, `${policy.domain}\n`].includes(
      git(repository, "show", `${commit}:CNAME`).toString(),
    )
  )
    throw new Error("Retain the approved publication domain in CNAME.");
  const destination = resolve(output);
  await mkdir(destination);
  try {
    let mediaFiles = 0,
      checkedLinks = 0;
    for (const [path, { object }] of entries) {
      const bytes = git(repository, "cat-file", "blob", object);
      await mkdir(dirname(join(destination, path)), { recursive: true });
      await writeFile(join(destination, path), bytes, { flag: "wx" });
      if (/\.(?:md|html)$/i.test(path)) {
        const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        const receive = (target) => {
          checkDestination(path, target, entries);
          checkedLinks++;
          return target;
        };
        if (/\.md$/i.test(path)) rewriteLinks(content, receive);
        else
          for (const match of content.matchAll(
            /\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi,
          ))
            receive(match[2]);
      } else if (
        /\.(?:svg|png|jpe?g|avif|webp|gif|ico|pdf|mp4|webm|woff2?)$/i.test(path)
      )
        mediaFiles++;
    }
    return {
      commit,
      files: entries.size,
      bytes: totalBytes,
      mediaFiles,
      checkedLinks,
      domain: policy.domain,
    };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const [repository, commit, output, ...extra] = process.argv.slice(2);
    if (!repository || !output || extra.length)
      throw new Error(
        "Use verify-docs.mjs <candidate-repository> <full-commit> <new-scan-directory>.",
      );
    console.log(
      JSON.stringify(await verifyDocumentation({ repository, commit, output })),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
