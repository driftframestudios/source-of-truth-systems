import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  exampleData,
  prepareSourceCommand,
} from "../build/server/example-data.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";

const scenario = {
  version: 1,
  principalId: "prin_self",
  roleId: "arc_lead",
  environment: "res",
  grantChanges: [],
};
const data = { ...exampleData, sources: exampleData.sources.slice(0, 2) };
const [source, other] = data.sources;
const edit = () => ({
  id: source.id,
  expectedRevision: 0,
  idempotencyKey: randomUUID(),
  metadata: {
    title: "  Accepted source  ",
    description: "  Accepted summary. ",
    tags: ["review", " review "],
  },
});

/** This fixture observes API ownership; MySQL tests own transaction durability. */
function fixture() {
  let now = Date.parse("2026-11-17T12:00:00.000Z");
  let tokenHash = null;
  let origin = "https://app.example.test";
  let available = true;
  let mode = "stored";
  let failure = null;
  let forcedRefusal = null;
  const workspaces = new Map();
  const diagnostics = [];
  const live = (hash, requestedOrigin) => {
    const entry = workspaces.get(hash);
    return entry &&
      entry.origin === requestedOrigin &&
      Date.parse(entry.workspace.expiresAt) > now
      ? entry
      : null;
  };
  const store = {
    status: async () => ({ available, mode }),
    get: async (hash, at, requestedOrigin) =>
      live(hash, requestedOrigin)?.workspace ?? null,
    remove: async (hash, requestedOrigin) => ({
      removed: live(hash, requestedOrigin) ? workspaces.delete(hash) : false,
    }),
    readSources: async (hash, at, requestedOrigin) => {
      if (failure) throw failure;
      const entry = live(hash, requestedOrigin);
      return (
        entry && {
          workspace: entry.workspace,
          entries: [...entry.sources.values()],
        }
      );
    },
    history: async (hash, { sourceId, limit, origin: requestedOrigin }) => {
      const entry = live(hash, requestedOrigin);
      return (
        entry && {
          workspace: entry.workspace,
          events: entry.events
            .filter((event) => event.sourceId === sourceId)
            .slice(-limit)
            .reverse(),
        }
      );
    },
    mutateSource: async (hash, input, transition) => {
      if (failure) throw failure;
      if (forcedRefusal) return forcedRefusal;
      const entry = live(hash, input.origin);
      if (!entry)
        return { ok: false, kind: "expired", reason: "Workspace expired." };
      const prior = entry.receipts.get(input.idempotencyKey);
      if (prior)
        return prior.fingerprint === input.intentFingerprint
          ? { ...prior.result, replayed: true }
          : {
              ok: false,
              kind: "conflict",
              reason: "That command identifier belongs to another edit.",
            };
      const prepared = transition(entry.sources.get(input.sourceId) ?? null);
      if (!prepared.ok) return prepared;
      const current = {
        sourceId: input.sourceId,
        record: prepared.record,
        revision: prepared.revision,
      };
      let event = null;
      if (prepared.changed) {
        entry.sources.set(input.sourceId, current);
        event = {
          id: randomUUID(),
          sourceId: input.sourceId,
          action: input.command.type,
          actor: input.actor,
          createdAt: new Date(now).toISOString(),
          expectedRevision: input.command.revision,
          resultRevision: prepared.revision,
        };
        entry.events.push(event);
        entry.workspace = {
          ...entry.workspace,
          eventCount: entry.events.length,
        };
      }
      const result = {
        ok: true,
        changed: prepared.changed,
        replayed: false,
        entry: current,
        event,
        workspace: entry.workspace,
      };
      entry.receipts.set(input.idempotencyKey, {
        fingerprint: input.intentFingerprint,
        result,
      });
      return result;
    },
  };
  const api = createWorkspaceApi({
    data,
    prepareSourceCommand,
    onError: (error) => diagnostics.push(error),
    sessionPlugin: {
      onRequest({ requestHandler, setRequestHandler }) {
        setRequestHandler((request, context, fetchAPI) =>
          requestHandler(
            request,
            {
              ...context,
              visitorWorkspace: {
                store,
                tokenHash,
                now,
                origin,
                issueSession: async () => {
                  tokenHash = `private-${randomUUID()}`;
                  const workspace = {
                    id: randomUUID(),
                    createdAt: new Date(now).toISOString(),
                    expiresAt: new Date(now + 3_600_000).toISOString(),
                    eventCount: 0,
                  };
                  workspaces.set(tokenHash, {
                    origin,
                    workspace,
                    sources: new Map(),
                    events: [],
                    receipts: new Map(),
                  });
                  return { ok: true, workspace };
                },
                revokeSession: async () => {
                  const result = await store.remove(tokenHash, origin);
                  tokenHash = null;
                  return result;
                },
              },
            },
            fetchAPI,
          ),
        );
      },
    },
  });
  const hashes = new Map(
    api.operations.map((operation) => [operation.name, operation.sha256Hash]),
  );
  async function call(
    name,
    variables = {},
    selected = scenario,
    extensions = {},
  ) {
    const response = await api.yoga.fetch(
      "http://localhost/workspace/graphql",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extensions: {
            persistedQuery: { version: 1, sha256Hash: hashes.get(name) },
            scenario: selected,
            ...extensions,
          },
          variables,
        }),
      },
    );
    const body = await response.json();
    assert.equal(body.errors, undefined, JSON.stringify(body));
    return Object.values(body.data)[0];
  }
  return {
    api,
    call,
    hashes,
    diagnostics,
    store,
    token: () => tokenHash,
    useToken: (hash) => {
      tokenHash = hash;
    },
    useOrigin: (value) => {
      origin = value;
    },
    available: (value, nextMode = "unavailable") => {
      available = value;
      mode = nextMode;
    },
    fail: (error) => {
      failure = error;
    },
    refusal: (value) => {
      forcedRefusal = value;
    },
    advance: (milliseconds) => {
      now += milliseconds;
    },
    workspaces,
  };
}

test("cookie-owned workspaces isolate direct sources, snapshot fields and bounded history", async () => {
  const f = fixture();
  assert.equal((await f.call("WorkspaceStatus")).code, "ABSENT");
  const first = await f.call("StartWorkspace");
  const firstToken = f.token();
  assert.equal(first.code, "OK");
  assert.equal(
    (await f.call("StartWorkspace")).workspace.id,
    first.workspace.id,
  );
  const saved = await f.call("SaveSource", { input: edit() });
  assert.equal(saved.source.title, "Accepted source");
  assert.deepEqual(saved.source.tags, ["review"]);
  assert.equal(saved.source.revision, 1);
  f.useToken(null);
  const second = await f.call("StartWorkspace");
  const secondToken = f.token();
  assert.notEqual(first.workspace.id, second.workspace.id);
  assert.equal(
    (
      await f.call("WorkspaceSource", { id: source.id }, scenario, {
        workspaceId: first.workspace.id,
      })
    ).source.title,
    source.title,
  );
  assert.deepEqual(
    (await f.call("WorkspaceHistory", { sourceId: source.id })).events,
    [],
  );
  assert.equal(
    (await f.call("WorkspaceSnapshot")).sources[0].title,
    source.title,
  );
  f.useToken(firstToken);
  assert.equal(
    (await f.call("WorkspaceSource", { id: source.id })).source.title,
    "Accepted source",
  );
  const snapshot = await f.call("WorkspaceSnapshot");
  assert.equal(snapshot.sources[0].title, "Accepted source");
  assert.equal(snapshot.sources[1].title, other.title);
  const history = await f.call("WorkspaceHistory", { sourceId: source.id });
  assert.equal(history.events.length, 1);
  assert.equal(history.events[0].action, "save");
  assert.deepEqual(history.events[0].actor, {
    principalId: "prin_self",
    roleId: "arc_lead",
    environment: "res",
  });
  assert.equal(history.events[0].createdAt, "2026-11-17T12:00:00.000Z");
  assert.equal(history.events[0].resultRevision, 1);
  assert.equal(JSON.stringify([snapshot, history]).includes("private-"), false);
  assert.equal(
    (await f.call("WorkspaceHistory", { sourceId: source.id, limit: 21 })).code,
    "INVALID",
  );
  f.useOrigin("https://preview.example.test");
  assert.equal(
    (await f.call("WorkspaceSource", { id: source.id })).code,
    "EXPIRED",
  );
  assert.equal((await f.call("SaveSource", { input: edit() })).code, "EXPIRED");
  f.useOrigin("https://app.example.test");
  f.useToken(secondToken);
  assert.equal(
    (await f.call("WorkspaceSource", { id: source.id })).source.revision,
    0,
  );
});

test("normalized retries retain one event, current policy precedes replay, and stale edits preserve accepted metadata", async () => {
  const f = fixture();
  await f.call("StartWorkspace");
  const input = edit();
  const saved = await f.call("SaveSource", { input });
  const retried = await f.call("SaveSource", {
    input: {
      ...input,
      metadata: {
        title: "Accepted source",
        description: "Accepted summary.",
        tags: ["review"],
      },
    },
  });
  assert.equal(retried.replayed, true);
  assert.deepEqual(retried.source, saved.source);
  assert.equal(retried.workspace.eventCount, 1);
  assert.equal(
    (await f.call("SaveSource", { input }, { ...scenario, roleId: "viewer" }))
      .code,
    "DENIED",
  );
  assert.equal(
    (await f.call("SaveSource", { input }, { ...scenario, roleId: "admin" }))
      .code,
    "CONFLICT",
  );
  assert.equal(
    (
      await f.call("SaveSource", {
        input: {
          ...input,
          metadata: { ...input.metadata, title: "Another intent" },
        },
      })
    ).code,
    "CONFLICT",
  );
  assert.equal(
    (
      await f.call("SaveSource", {
        input: { ...input, idempotencyKey: randomUUID() },
      })
    ).code,
    "CONFLICT",
  );
  assert.equal(
    (await f.call("WorkspaceSource", { id: source.id })).source.title,
    "Accepted source",
  );
  const restore = await f.call("RestoreSource", {
    input: { id: source.id, expectedRevision: 1, idempotencyKey: randomUUID() },
  });
  assert.equal(restore.source.title, source.title);
  assert.equal(restore.source.description, source.description);
  assert.deepEqual(restore.source.tags, source.tags);
  assert.equal(restore.source.revision, 2);
  assert.equal(restore.workspace.eventCount, 2);
});

test("unsupported Unicode receives INVALID before storage admission", async () => {
  const f = fixture();
  await f.call("StartWorkspace");
  for (const title of [
    "Hidden\u0000text",
    "Incomplete\uD800",
    "\uDC00character",
  ]) {
    const input = edit();
    input.metadata.title = title;
    assert.equal((await f.call("SaveSource", { input })).code, "INVALID");
  }
  const history = await f.call("WorkspaceHistory", {
    sourceId: source.id,
    limit: 20,
  });
  assert.deepEqual(history.events, []);
});

test("no-op acceptance and its retry remain unchanged; invalid and denied intents reach no storage effect", async () => {
  const f = fixture();
  await f.call("StartWorkspace");
  const input = {
    id: source.id,
    expectedRevision: 0,
    idempotencyKey: randomUUID(),
  };
  assert.equal((await f.call("RestoreSource", { input })).changed, false);
  const retry = await f.call("RestoreSource", { input });
  assert.equal(retry.replayed, true);
  assert.equal(retry.workspace.eventCount, 0);
  assert.equal(
    (
      await f.call("SaveSource", {
        input: {
          ...edit(),
          metadata: { title: " ", description: "summary", tags: [] },
        },
      })
    ).code,
    "INVALID",
  );
  assert.equal(
    (
      await f.call("SaveSource", {
        input: { ...edit(), idempotencyKey: "same-key" },
      })
    ).code,
    "INVALID",
  );
  assert.equal(
    (
      await f.call(
        "SaveSource",
        { input: edit() },
        { ...scenario, environment: "val" },
      )
    ).code,
    "DENIED",
  );
  assert.equal(
    (
      await f.call(
        "WorkspaceSnapshot",
        {},
        { ...scenario, principalId: "not-a-person" },
      )
    ).code,
    "INVALID",
  );
  assert.equal(
    (await f.call("WorkspaceSource", { id: "constructor" })).code,
    "MISSING",
  );
  assert.equal((await f.call("WorkspaceStatus")).workspace.eventCount, 0);
});

test("reset and expiry affect only the current workspace; unavailability preserves typed outcomes and masks internals", async () => {
  const f = fixture();
  await f.call("StartWorkspace");
  const firstToken = f.token();
  await f.call("SaveSource", { input: edit() });
  f.useToken(null);
  await f.call("StartWorkspace");
  const secondToken = f.token();
  f.useToken(firstToken);
  assert.equal(
    (
      await f.call(
        "ResetWorkspace",
        {},
        { ...scenario, roleId: "viewer", environment: "val" },
      )
    ).code,
    "ABSENT",
  );
  assert.equal(await f.store.get(firstToken), null);
  f.useToken(secondToken);
  assert.equal((await f.call("WorkspaceStatus")).code, "OK");
  f.advance(3_600_001);
  assert.equal((await f.call("WorkspaceStatus")).code, "EXPIRED");
  assert.equal((await f.call("WorkspaceSnapshot")).code, "EXPIRED");
  assert.equal((await f.call("SaveSource", { input: edit() })).code, "EXPIRED");
  assert.equal((await f.call("StartWorkspace")).code, "OK");
  f.refusal({
    ok: false,
    kind: "quota",
    reason: "The workspace reached its edit allowance.",
  });
  assert.equal((await f.call("SaveSource", { input: edit() })).code, "QUOTA");
  f.refusal(null);
  f.fail(new Error("SELECT private_table PASSWORD secret"));
  const unavailable = await f.call("WorkspaceSnapshot");
  assert.equal(unavailable.code, "UNAVAILABLE");
  assert.equal(JSON.stringify(unavailable).includes("private_table"), false);
  assert.equal(f.diagnostics.length, 1);
  f.available(false);
  assert.equal((await f.call("StartWorkspace")).code, "UNAVAILABLE");
});

test("registered workspace operations retain finite admission and reject caller-selected workspace inputs", async () => {
  const f = fixture();
  await f.call("StartWorkspace");
  async function request(body, method = "POST") {
    const query =
      method === "GET"
        ? `?extensions=${encodeURIComponent(JSON.stringify(body.extensions))}`
        : "";
    const response = await f.api.yoga.fetch(
      `http://localhost/workspace/graphql${query}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      },
    );
    return response.json();
  }
  assert.ok(
    (await request({ query: "mutation { resetWorkspace { code } }" })).errors,
  );
  assert.ok(
    (
      await request({
        extensions: {
          persistedQuery: { version: 1, sha256Hash: "f".repeat(64) },
        },
      })
    ).errors,
  );
  assert.ok(
    (await request([{ query: "{ workspaceStatus { code } }" }])).errors,
  );
  assert.ok(
    (
      await request(
        {
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: f.hashes.get("ResetWorkspace"),
            },
          },
        },
        "GET",
      )
    ).errors,
  );
  assert.ok(
    (
      await request({
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: f.hashes.get("SaveSource"),
          },
        },
        variables: { input: { ...edit(), workspaceId: "another-workspace" } },
      })
    ).errors,
  );
  assert.equal((await f.call("WorkspaceStatus")).workspace.eventCount, 0);
});

test("only an explicitly absent installation permits local operation and a retained cookie prevents downgrade", async () => {
  const f = fixture();
  f.available(false, "local");
  const local = await f.call("WorkspaceStatus");
  assert.equal(local.code, "LOCAL");
  assert.equal(local.available, false);
  f.useToken("previous-hosted-session");
  assert.equal((await f.call("WorkspaceStatus")).code, "UNAVAILABLE");
  f.useToken(null);
  f.available(false, "unavailable");
  assert.equal((await f.call("WorkspaceStatus")).code, "UNAVAILABLE");
});
