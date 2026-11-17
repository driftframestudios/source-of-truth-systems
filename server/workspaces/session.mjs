import { createHash, randomBytes, randomUUID } from "node:crypto";
import { WORKSPACE_LIMITS } from "./limits.mjs";

export const SESSION_LIMITS = Object.freeze({ creationsPerMinute: 20 });
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

function refusal(code, message, status = 403) {
  return Response.json(
    { errors: [{ message, extensions: { code } }] },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Origin proves the browser request route; the opaque cookie owns the sandbox. */
function admit(request) {
  if (request.method !== "POST") return null;
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return null;
  if (request.headers.get("x-sot-workspace") !== "1") return null;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return null;
  try {
    const raw = request.headers.get("origin");
    const origin = new URL(raw);
    if (raw !== origin.origin) return null;
    const local = origin.protocol === "http:" && LOOPBACK.has(origin.hostname);
    if (origin.protocol !== "https:" && !local) return null;
    // TLS may terminate at the host's proxy. Match its HTTP Host to the browser
    // origin without accepting a client-supplied forwarded-host substitute.
    const host = request.headers.get("host");
    if (
      !host ||
      new URL(`${origin.protocol}//${host}`).origin !== origin.origin
    )
      return null;
    return { origin: origin.origin, local };
  } catch {
    return null;
  }
}

function cookieToken(request, name) {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(name.length + 1);
  return TOKEN.test(token) ? token : null;
}

export function createWorkspaceSessionPlugin({ store, clock = Date.now }) {
  let admissions = { start: 0, count: 0 };
  return {
    onRequest({ requestHandler, setRequestHandler }) {
      setRequestHandler(async (request, context, fetchAPI) => {
        const route = admit(request);
        if (!route)
          return refusal(
            "WORKSPACE_REQUEST_INVALID",
            "Use the application to access your visitor workspace.",
          );
        const now = clock();
        const name = route.local
          ? "sot-workspace-local"
          : "__Host-sot-workspace";
        const token = cookieToken(request, name);
        const tokenHash = token
          ? createHash("sha256").update(token).digest("hex")
          : null;
        let responseCookie;
        const cookie = (value, seconds) =>
          `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${route.local ? "" : "; Secure"}`;
        const visitorWorkspace = {
          store,
          tokenHash,
          now,
          origin: route.origin,
          async issueSession() {
            if (request.signal.aborted)
              return {
                ok: false,
                kind: "unavailable",
                reason: "Workspace request ended. Retry when ready.",
              };
            if (tokenHash) {
              const existing = await store.get(tokenHash, now, route.origin);
              if (existing) return { ok: true, workspace: existing };
            }
            if (request.signal.aborted)
              return {
                ok: false,
                kind: "unavailable",
                reason: "Workspace request ended. Retry when ready.",
              };
            if (now - admissions.start >= 60_000)
              admissions = { start: now, count: 0 };
            if (admissions.count >= SESSION_LIMITS.creationsPerMinute)
              return {
                ok: false,
                kind: "quota",
                reason:
                  "Visitor workspace creation is busy. Try again shortly.",
              };
            admissions.count += 1;
            const issued = randomBytes(32).toString("base64url");
            const expiresAt = now + WORKSPACE_LIMITS.ttlMs;
            const accepted = await store.create({
              id: randomUUID(),
              tokenHash: createHash("sha256").update(issued).digest("hex"),
              now,
              expiresAt,
              origin: route.origin,
            });
            if (accepted.ok)
              responseCookie = cookie(
                issued,
                Math.floor((expiresAt - now) / 1000),
              );
            return accepted;
          },
          async revokeSession() {
            const result = tokenHash
              ? await store.remove(tokenHash, route.origin)
              : { removed: false };
            responseCookie = cookie("", 0);
            return result;
          },
        };
        const response = await requestHandler(
          request,
          { ...context, visitorWorkspace },
          fetchAPI,
        );
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store");
        if (responseCookie) headers.append("Set-Cookie", responseCookie);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      });
    },
  };
}
