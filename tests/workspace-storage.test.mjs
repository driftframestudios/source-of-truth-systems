import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceStore } from "../server/workspaces/store.mjs";
import { workspaceTransaction } from "../server/workspaces/connection.mjs";
import { WORKSPACE_LIMITS } from "../server/workspaces/limits.mjs";

test("invalid workspace commands fail before opening a database connection", async () => {
  const store = createWorkspaceStore(
    {},
    {
      connect: () => {
        throw new Error("Invalid input reached storage");
      },
    },
  );
  const now = Date.UTC(2026, 10, 17);
  const identity = {
    id: "00000000-0000-4000-8000-000000000001",
    tokenHash: "a".repeat(64),
    now,
    expiresAt: now + WORKSPACE_LIMITS.ttlMs,
    origin: "https://showcase.example",
  };
  assert.equal(
    (await store.create({ ...identity, expiresAt: identity.expiresAt + 1 }))
      .kind,
    "invalid",
  );
  assert.equal(
    (
      await store.create({
        ...identity,
        origin: "https://showcase.example/private",
      })
    ).kind,
    "invalid",
  );
  assert.equal(
    (await store.create({ ...identity, origin: "http://public.example" })).kind,
    "invalid",
  );
  assert.equal(await store.get("invalid-token", now, identity.origin), null);
  const command = {
    idempotencyKey: "a".repeat(81),
    intentFingerprint: "b".repeat(64),
    sourceId: "source",
    now,
    origin: identity.origin,
    actor: { principalId: "scientist", roleId: "admin", environment: "DEV" },
    command: { type: "restore", revision: 0 },
  };
  assert.equal(
    (await store.mutateSource(identity.tokenHash, command, () => {})).kind,
    "invalid",
  );
  assert.equal(
    (
      await store.mutateSource(
        identity.tokenHash,
        {
          ...command,
          idempotencyKey: "valid",
          command: {
            type: "save",
            revision: 0,
            metadata: {
              title: "x".repeat(181),
              description: "summary",
              tags: [],
            },
          },
        },
        () => {},
      )
    ).kind,
    "invalid",
  );
  assert.equal(
    await store.history(identity.tokenHash, {
      sourceId: "source",
      now,
      origin: identity.origin,
      limit: 65,
    }),
    null,
  );
});

test("a write owns READ COMMITTED acceptance and closes its connection on commit or refusal failure", async () => {
  for (const fail of [false, true]) {
    const operations = [];
    const connection = {
      query: async (sql) => {
        operations.push(sql);
      },
      beginTransaction: async () => {
        operations.push("begin");
      },
      commit: async () => {
        operations.push("commit");
      },
      rollback: async () => {
        operations.push("rollback");
      },
      end: async () => {
        operations.push("end");
      },
      destroy: () => {
        operations.push("destroy");
      },
    };
    const request = workspaceTransaction(
      {},
      async () => {
        operations.push("transition");
        if (fail) throw new Error("Transition failed");
        return { accepted: true };
      },
      { write: true, connect: async () => connection },
    );
    if (fail) await assert.rejects(request, /Transition failed/);
    else assert.deepEqual(await request, { accepted: true });
    assert.deepEqual(operations, [
      "SET SESSION innodb_lock_wait_timeout = 2",
      "SET TRANSACTION ISOLATION LEVEL READ COMMITTED, READ WRITE",
      "begin",
      "transition",
      fail ? "rollback" : "commit",
      "end",
      "destroy",
    ]);
  }
});

test("read snapshots close with rollback and unavailable storage has an explicit mode", async () => {
  const operations = [];
  const connection = {
    query: async (sql) => {
      operations.push(sql);
    },
    beginTransaction: async () => {},
    rollback: async () => {
      operations.push("rollback");
    },
    end: async () => {},
    destroy: () => {},
  };
  await workspaceTransaction({}, async () => null, {
    connect: async () => connection,
  });
  assert.ok(
    operations.includes(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
    ),
  );
  assert.equal(operations.at(-1), "rollback");
  const unavailable = createWorkspaceStore(
    {},
    {
      connect: async () => {
        throw new Error("Offline");
      },
    },
  );
  assert.deepEqual(await unavailable.status(), {
    available: false,
    mode: "unavailable",
  });
});
