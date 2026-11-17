import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  createWorkspaceSessionPlugin,
  SESSION_LIMITS,
} from "../server/workspaces/session.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";
import {
  exampleData,
  prepareSourceCommand,
} from "../build/server/example-data.mjs";

function fixture() {
  const rows = new Map();
  const calls = [];
  const view = (row) => ({
    id: row.id,
    createdAt: new Date(row.now).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
    eventCount: 0,
  });
  const store = {
    async create(input) {
      calls.push(input);
      rows.set(input.tokenHash, input);
      return { ok: true, workspace: view(input) };
    },
    async get(hash, now, origin) {
      const row = rows.get(hash);
      return row?.origin === origin && row.expiresAt > now ? view(row) : null;
    },
    async remove(hash, origin) {
      const row = rows.get(hash);
      return { removed: row?.origin === origin && rows.delete(hash) };
    },
  };
  const clock = { now: 1_800_000_000_000 };
  const plugin = createWorkspaceSessionPlugin({
    store,
    clock: () => clock.now,
  });
  function send({
    origin = "https://example.test",
    host = "example.test",
    cookie,
    method = "POST",
    contentType = "application/json",
    marker = "1",
    site = "same-origin",
    action = "start",
  } = {}) {
    let handler;
    plugin.onRequest({
      requestHandler: async (_request, { visitorWorkspace }) => {
        const value =
          action === "reset"
            ? await visitorWorkspace.revokeSession()
            : action === "inspect"
              ? { hash: visitorWorkspace.tokenHash }
              : await visitorWorkspace.issueSession();
        return Response.json(value);
      },
      setRequestHandler: (value) => {
        handler = value;
      },
    });
    const headers = new Headers({
      host,
      "content-type": contentType,
      "x-sot-workspace": marker,
      "sec-fetch-site": site,
    });
    if (origin !== null) headers.set("origin", origin);
    if (cookie) headers.set("cookie", cookie);
    return handler(
      new Request(`http://${host}/workspace/graphql`, { method, headers }),
      {},
      {},
    );
  }
  return { send, rows, calls, clock, store };
}

test("workspace admission rejects cross-origin, simple, insecure, and malformed routes before storage", async () => {
  const f = fixture();
  for (const input of [
    { method: "GET" },
    { contentType: "text/plain" },
    { marker: "" },
    { origin: null },
    { origin: "null" },
    { origin: "https://other.test" },
    { origin: "https://example.test/path" },
    { origin: "http://example.test" },
    { origin: "https://example.test", site: "same-site" },
    { origin: "https://example.test:444" },
  ]) {
    const response = await f.send(input);
    assert.equal(response.status, 403, JSON.stringify(input));
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(f.calls.length, 0);
});

test("HTTPS issues an opaque protected cookie, persists only its verifier, reuses then revokes", async () => {
  const f = fixture();
  const response = await f.send();
  assert.equal(response.headers.get("cache-control"), "no-store");
  const setCookie = response.headers.get("set-cookie");
  assert.match(
    setCookie,
    /^__Host-sot-workspace=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=86400; Secure$/,
  );
  const cookie = setCookie.split(";")[0];
  const raw = cookie.split("=")[1];
  assert.equal(
    f.calls[0].tokenHash,
    createHash("sha256").update(raw).digest("hex"),
  );
  assert.equal(JSON.stringify(f.calls).includes(raw), false);
  const first = await response.json();
  const reused = await f.send({ cookie });
  assert.equal((await reused.json()).workspace.id, first.workspace.id);
  assert.equal(reused.headers.has("set-cookie"), false);
  assert.equal(f.calls.length, 1);
  const reset = await f.send({ cookie, action: "reset" });
  assert.deepEqual(await reset.json(), { removed: true });
  assert.match(reset.headers.get("set-cookie"), /Max-Age=0; Secure$/);
  assert.equal(f.rows.size, 0);
});

test("loopback cookie is separate, duplicate tokens fail closed, and origin ports own independent scopes", async () => {
  const f = fixture();
  const response = await f.send({
    origin: "http://localhost:3000",
    host: "localhost:3000",
  });
  const localCookie = response.headers.get("set-cookie");
  assert.match(localCookie, /^sot-workspace-local=/);
  assert.equal(localCookie.includes("Secure"), false);
  const first = await response.json();
  const cookie = localCookie.split(";")[0];
  const second = await f.send({
    origin: "http://localhost:3001",
    host: "localhost:3001",
    cookie,
  });
  assert.notEqual((await second.json()).workspace.id, first.workspace.id);
  const duplicate = await f.send({
    cookie:
      "__Host-sot-workspace=" +
      "A".repeat(43) +
      "; __Host-sot-workspace=" +
      "B".repeat(43),
    action: "inspect",
  });
  assert.deepEqual(await duplicate.json(), { hash: null });
});

test("creation is bounded per process and expiry starts a new absolute lifetime", async () => {
  const f = fixture();
  const response = await f.send();
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const first = await response.json();
  for (let i = 1; i < SESSION_LIMITS.creationsPerMinute; i += 1)
    assert.equal((await (await f.send()).json()).ok, true);
  assert.equal((await (await f.send()).json()).kind, "quota");
  assert.equal(f.calls.length, SESSION_LIMITS.creationsPerMinute);
  f.clock.now += 24 * 60 * 60 * 1000;
  const expired = await f.send({ cookie });
  assert.notEqual((await expired.json()).workspace.id, first.workspace.id);
});

test("real Yoga transport carries the cookie scope into registered resolvers and protects errors", async () => {
  const f = fixture();
  f.store.status = async () => ({ available: true });
  const api = createWorkspaceApi({
    data: exampleData,
    prepareSourceCommand,
    sessionPlugin: createWorkspaceSessionPlugin({
      store: f.store,
      clock: () => f.clock.now,
    }),
  });
  const hashes = new Map(api.operations.map((op) => [op.name, op.sha256Hash]));
  const request = (operationName, cookie, origin = "https://example.test") =>
    api.yoga.fetch("https://example.test/workspace/graphql", {
      method: "POST",
      headers: {
        host: "example.test",
        origin,
        "content-type": "application/json",
        "x-sot-workspace": "1",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        operationName,
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: hashes.get(operationName) ?? "0".repeat(64),
          },
        },
      }),
    });
  const started = await request("StartWorkspace");
  const body = await started.json();
  assert.equal(body.data.startWorkspace.code, "OK", JSON.stringify(body));
  const cookie = started.headers.get("set-cookie").split(";")[0];
  const status = await request("WorkspaceStatus", cookie);
  assert.equal(
    (await status.json()).data.workspaceStatus.workspace.id,
    body.data.startWorkspace.workspace.id,
  );
  const invalid = await request("Unregistered");
  assert.ok((await invalid.json()).errors);
  assert.equal(invalid.headers.get("cache-control"), "no-store");
  const hostile = await request("StartWorkspace", cookie, "https://other.test");
  assert.equal(hostile.status, 403);
  assert.equal(f.calls.length, 1);
});

test("a deadline remains uncached and cancels issuance after slow admission", async () => {
  const f = fixture();
  let release;
  f.store.status = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const api = createWorkspaceApi({
    data: exampleData,
    prepareSourceCommand,
    sessionPlugin: createWorkspaceSessionPlugin({
      store: f.store,
      clock: () => f.clock.now,
    }),
  });
  const hash = api.operations.find(
    (op) => op.name === "StartWorkspace",
  ).sha256Hash;
  const response = await api.yoga.fetch(
    "https://example.test/workspace/graphql",
    {
      method: "POST",
      headers: {
        host: "example.test",
        origin: "https://example.test",
        "content-type": "application/json",
        "x-sot-workspace": "1",
      },
      body: JSON.stringify({
        extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
      }),
    },
  );
  assert.equal(response.status, 504);
  assert.equal(response.headers.get("cache-control"), "no-store");
  release({ available: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 0);
});
