import { createHash } from "node:crypto";

/** The reviewed build owns its bootstrap; runtime/user text never supplies script hashes. */
export function documentPolicy(html) {
  const hashes = [];
  for (const [, attributes, body] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
  )) {
    if (/(?:^|\s)src\s*=/i.test(attributes) || !body.trim()) continue;
    if (
      !/(?:^|\s)id\s*=\s*["']initial-load-bootstrap["'](?=\s|$)/i.test(
        attributes,
      ) ||
      hashes.length
    ) {
      throw new Error(
        "The production document contains an unreviewed inline script.",
      );
    }
    hashes.push(
      `'sha256-${createHash("sha256").update(body).digest("base64")}'`,
    );
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`.trim(),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-src 'none'",
    // Hosting preview embeds remain supported until their parent origins are known.
  ].join("; ");
}
