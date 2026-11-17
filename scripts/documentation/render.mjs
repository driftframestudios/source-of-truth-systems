import MarkdownIt from "markdown-it";
import { articleRoute, articleSource, resolveSource } from "./manifest.mjs";
export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const headingId = (value) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-") || "section";
export function createMarkdownRenderer({ articles, documents, base, source }) {
  const routes = new Map(
    articles.map((article) => [
      articleSource(article),
      articleRoute(base, article.slug),
    ]),
  );
  const references = new Set();
  const resolveLink = (target) => {
    if (target.startsWith("#")) return target;
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) {
      try {
        const url = new URL(target);
        return ["https:", "http:", "mailto:"].includes(url.protocol) &&
          !url.username &&
          !url.password
          ? url.href
          : null;
      } catch {
        return null;
      }
    }
    if (target.startsWith("//")) return null;
    const [raw, fragment] = target.split("#");
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (decoded.includes("?") || decoded.includes("\\")) return null;
    const path = resolveSource(source, decoded);
    if (routes.has(path))
      return routes.get(path) + (fragment ? `#${fragment}` : "");
    references.add(path);
    return null;
  };
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
  });
  md.core.ruler.push("owned-links", (state) => {
    const ids = new Map();
    for (let index = 0; index < state.tokens.length; index++) {
      const token = state.tokens[index];
      if (token.type === "heading_open") {
        const title = state.tokens[index + 1]?.content ?? "section",
          key = headingId(title),
          number = ids.get(key) ?? 0;
        ids.set(key, number + 1);
        token.attrSet("id", key + (number ? `-${number}` : ""));
      }
      const stack = [];
      for (const child of token.children ?? []) {
        if (child.type === "link_open") {
          const target = child.attrGet("href") ?? "",
            resolved = resolveLink(target);
          stack.push(Boolean(resolved));
          if (resolved) child.attrSet("href", resolved);
          else {
            child.tag = "span";
            child.attrs = [
              ["class", "docs-source-reference"],
              ["title", `Repository reference: ${target}`],
            ];
          }
        } else if (child.type === "link_close" && !stack.pop())
          child.tag = "span";
        if (child.type === "image") {
          child.type = "text";
          child.content = child.content || "Image reference";
          child.children = null;
          child.attrs = null;
        }
      }
    }
  });
  return { render: (text) => md.render(text), references };
}
export function renderPage({
  article,
  text,
  manifest,
  base,
  origin,
  appUrl,
  entry,
}) {
  const renderer = createMarkdownRenderer({
    articles: manifest.articles,
    base,
    source: articleSource(article),
  });
  const body = renderer.render(text.replace(/^---\n[\s\S]*?\n---\n/, ""));
  const route = articleRoute(base, article.slug),
    canonical = origin + route;
  let lastGroup;
  const navigation = manifest.articles
    .map((item) => {
      const heading =
        lastGroup !== item.group
          ? `<p class="docs-nav-group">${escapeHtml(item.group)}</p>`
          : "";
      lastGroup = item.group;
      return `${heading}<a href="${articleRoute(base, item.slug)}" ${item.slug === article.slug ? 'aria-current="page"' : ""}>${escapeHtml(item.title)}</a>`;
    })
    .join("\n");
  const source = article.source
    ? `Source: <code>${escapeHtml(article.source)}</code>`
    : "Generated from server-owned schemas and registered operations.";
  return `<!doctype html><html lang="en" data-appearance="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(article.title)} · Source of Truth</title><meta name="description" content="${escapeHtml(article.description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escapeHtml(article.title)} · Source of Truth"><meta property="og:description" content="${escapeHtml(article.description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article"><link rel="describedby" type="text/plain" href="${base}llms.txt"><script type="module" src="${entry}"></script></head><body data-documentation-entry><a class="docs-skip" href="#article">Skip to article</a><header class="docs-header"><a class="docs-brand" href="${base}"><strong>Source of Truth</strong><span>for Life Sciences / Developer guide</span></a><div id="docs-appearance"></div><a class="docs-open-app" href="${escapeHtml(appUrl)}">Explore the application ↗</a></header><div class="docs-layout"><aside class="docs-sidebar"><details open><summary>Documentation</summary><nav aria-label="Documentation">${navigation}</nav></details></aside><main id="article" tabindex="-1"><div class="docs-kicker">${escapeHtml(article.group)} / Developer documentation</div><article>${body}</article>${
    renderer.references.size
      ? `<section class="docs-references"><h2>Repository references</h2><p>These paths identify source in the clone. They are not application routes.</p><ul>${[
          ...renderer.references,
        ]
          .sort()
          .map((path) => `<li><code>${escapeHtml(path)}</code></li>`)
          .join("")}</ul></section>`
      : ""
  }<footer class="docs-footer"><p>${source}</p><a href="${base}llms-full.txt">Read the complete source documentation</a><p>Copyright © Vikrant Varun Kudesia | Driftframe Studios, LLC.</p></footer></main></div></body></html>`;
}
