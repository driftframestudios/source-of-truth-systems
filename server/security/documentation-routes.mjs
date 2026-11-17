import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { documentPolicy } from "./document-policy.mjs";
/** Exact build-owned routes; arbitrary paths keep the static server's ordinary 404. */
async function readBuiltDocument(directory, path) {
  const parts = path.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const state = await lstat(join(directory, ...parts.slice(0, i)));
    if (
      state.isSymbolicLink() ||
      !(i === parts.length ? state.isFile() : state.isDirectory())
    )
      throw new Error(
        "Documentation build requires ordinary files and directories.",
      );
  }
  return readFile(join(directory, path), "utf8");
}
export async function documentationRoutes(directory) {
  let manifest;
  try {
    manifest = JSON.parse(
      await readBuiltDocument(directory, "docs/routes.json"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.routes))
    throw new Error("Documentation route build is invalid.");
  const routes = new Map();
  for (const entry of manifest.routes) {
    if (
      !/^\/docs\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?$/.test(entry.route) ||
      entry.file !== `${entry.route.slice(6)}index.html` ||
      routes.has(entry.route)
    )
      throw new Error(
        "Documentation routes require exact generated article paths.",
      );
    const html = await readBuiltDocument(directory, `docs/${entry.file}`);
    routes.set(entry.route, { html, policy: documentPolicy(html) });
  }
  return routes;
}
export function serveDocumentation(request, response, routes) {
  const path = request.url?.split("?")[0],
    canonical = path?.endsWith("/index.html")
      ? path.slice(0, -10)
      : path?.endsWith("/")
        ? path
        : `${path}/`;
  const entry = routes.get(canonical);
  if (!entry) return false;
  if (path !== canonical) {
    response.writeHead(308, { Location: canonical });
    response.end();
    return true;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
    "Content-Security-Policy": entry.policy,
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : entry.html);
  return true;
}
