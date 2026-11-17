import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import mysql from "mysql2/promise";
import { readDatabaseConfig } from "../server/data/connection.mjs";
import { initializeWorkspaces } from "../server/workspaces/initialize.mjs";
import { createWorkspaceStore } from "../server/workspaces/store.mjs";
import { WORKSPACE_LIMITS } from "../server/workspaces/limits.mjs";
import { initializeCatalog } from "../server/data/initialize-catalog.mjs";
import { CATALOG_TABLES } from "../server/data/catalog-schema.mjs";
import {
  WORKSPACE_SCHEMA_SIGNATURE,
  WORKSPACE_SCHEMA_STATEMENTS,
  WORKSPACE_TABLES,
} from "../server/workspaces/schema.mjs";

const enabled = process.env.MYSQL_WORKSPACE_TEST === "1";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const actor = { principalId: "scientist", roleId: "admin", environment: "DEV" };
const record = {
  title: "Accepted source",
  description: "A useful source summary.",
  tags: ["genomics"],
};
const now = Date.UTC(2026, 10, 17);
const origin = "https://showcase.example";
const make = (token = randomUUID(), at = now) => ({
  id: randomUUID(),
  tokenHash: hash(token),
  origin,
  now: at,
  expiresAt: at + WORKSPACE_LIMITS.ttlMs,
});
const input = (revision = 0, extra = {}) => {
  const command = { type: "save", revision, metadata: record };
  return {
    idempotencyKey: randomUUID(),
    intentFingerprint: hash(JSON.stringify({ command, actor })),
    sourceId: "source-1",
    now,
    origin,
    actor,
    command,
    ...extra,
  };
};
const accept = (current) => ({
  ok: true,
  changed: true,
  record,
  revision: (current?.revision ?? 0) + 1,
});

test(
  "isolated visitor storage uses bounded transactions and explicit additive migration",
  { skip: !enabled, timeout: 15000 },
  async (t) => {
    const config = readDatabaseConfig();
    assert.equal(config.mode, "mysql");
    assert.match(config.options.database, /^sot_[a-z0-9_]+_(?:test|proof)$/);
    const options = {
      ...config.options,
      ...(process.env.MYSQL_WORKSPACE_SOCKET
        ? { socketPath: process.env.MYSQL_WORKSPACE_SOCKET }
        : {}),
    };
    const connection = await mysql.createConnection(options);
    const store = createWorkspaceStore(options);
    const race = async (lockSql, lockValues, submit) => {
      await connection.beginTransaction();
      await connection.execute(lockSql, lockValues);
      let entered = 0,
        release;
      const waiting = new Promise((resolve) => {
        release = resolve;
      });
      const contender = createWorkspaceStore(options, {
        connect: async (config) => {
          const db = await mysql.createConnection(config);
          const execute = db.execute.bind(db);
          db.execute = (sql, values) => {
            const pending = execute(sql, values);
            if (sql.includes("FOR UPDATE") && ++entered === 2) release();
            return pending;
          };
          return db;
        },
      });
      const pending = submit(contender);
      try {
        await waiting;
        await connection.commit();
        return await Promise.all(pending);
      } finally {
        await connection.rollback();
      }
    };
    const clear = async () => {
      for (const table of [...WORKSPACE_TABLES].reverse())
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
    };
    await clear();
    try {
      await t.test(
        "migration retains unrelated populated catalog, repeats, and resumes owned empty DDL",
        async () => {
          const { exampleData } =
            await import("../build/server/example-data.mjs");
          await initializeCatalog(connection, exampleData);
          const snapshot = async () => {
            const tables = [];
            for (const table of CATALOG_TABLES) {
              const [rows] = await connection.query(`SELECT * FROM ${table}`);
              tables.push(rows.map((row) => JSON.stringify(row)).sort());
            }
            return tables;
          };
          const catalogBefore = await snapshot();
          assert.deepEqual(await store.status(), {
            available: false,
            mode: "local",
          });
          assert.equal(
            (await initializeWorkspaces(connection)).initialized,
            true,
          );
          assert.equal(
            (await initializeWorkspaces(connection)).initialized,
            false,
          );
          assert.deepEqual(await store.status(), {
            available: true,
            mode: "stored",
          });
          assert.deepEqual(await snapshot(), catalogBefore);
          await clear();
          await connection.query(WORKSPACE_SCHEMA_STATEMENTS[0]);
          await connection.execute(
            "INSERT INTO showcase_workspace_schema VALUES (1, 0, ?)",
            [WORKSPACE_SCHEMA_SIGNATURE],
          );
          await connection.query(WORKSPACE_SCHEMA_STATEMENTS[1]);
          assert.deepEqual(await store.status(), {
            available: false,
            mode: "unavailable",
          });
          assert.equal(
            (await initializeWorkspaces(connection)).initialized,
            true,
          );
          await clear();
          await connection.query(WORKSPACE_SCHEMA_STATEMENTS[1]);
          await assert.rejects(initializeWorkspaces(connection), {
            code: "WORKSPACE_SCHEMA_UNAVAILABLE",
          });
          await clear();
          await initializeWorkspaces(connection);
          await connection.query(
            "ALTER TABLE showcase_workspace_sources MODIFY revision INT UNSIGNED NOT NULL",
          );
          assert.deepEqual(await store.status(), {
            available: false,
            mode: "unavailable",
          });
          await assert.rejects(initializeWorkspaces(connection), {
            code: "WORKSPACE_SCHEMA_UNAVAILABLE",
          });
          await connection.query(
            "ALTER TABLE showcase_workspace_sources MODIFY revision SMALLINT UNSIGNED NOT NULL",
          );
          const outage = createWorkspaceStore(options, {
            connect: async () => {
              throw new Error("Connection unavailable");
            },
          });
          assert.deepEqual(await outage.status(), {
            available: false,
            mode: "unavailable",
          });
        },
      );

      const first = make(),
        second = make();
      await store.create(first);
      await store.create(second);
      await t.test(
        "isolated save, denial, stale edit, immutable retry, and restart",
        async () => {
          const command = input();
          const accepted = await store.mutateSource(
            first.tokenHash,
            command,
            accept,
          );
          assert.equal(accepted.ok, true);
          assert.equal(accepted.entry.revision, 1);
          assert.equal(accepted.workspace.eventCount, 1);
          assert.deepEqual(
            (await store.readSources(second.tokenHash, now, origin)).entries,
            [],
          );
          const denied = await store.mutateSource(
            first.tokenHash,
            input(1),
            () => ({ ok: false, kind: "role", reason: "Role cannot edit." }),
          );
          assert.equal(denied.kind, "role");
          assert.equal(
            (
              await store.history(first.tokenHash, {
                sourceId: "source-1",
                now,
                origin,
              })
            ).events.length,
            1,
          );
          assert.equal(
            (await store.mutateSource(first.tokenHash, input(0), accept)).kind,
            "conflict",
          );
          const updated = { ...record, title: "Later source" };
          await store.mutateSource(first.tokenHash, input(1), (current) => ({
            ok: true,
            changed: true,
            record: updated,
            revision: current.revision + 1,
          }));
          const restarted = createWorkspaceStore(options);
          const replay = await restarted.mutateSource(
            first.tokenHash,
            command,
            () => {
              throw new Error("Retry must use saved receipt.");
            },
          );
          assert.equal(replay.replayed, true);
          assert.deepEqual(replay.entry, accepted.entry);
          assert.deepEqual(replay.event, accepted.event);
          assert.equal(
            (await restarted.readSources(first.tokenHash, now, origin))
              .entries[0].record.title,
            "Later source",
          );
          const changedIntent = await store.mutateSource(
            first.tokenHash,
            { ...command, intentFingerprint: hash("different") },
            accept,
          );
          assert.equal(changedIntent.kind, "conflict");
          const noOp = input(2);
          const unchanged = await store.mutateSource(
            first.tokenHash,
            noOp,
            (current) => ({ ok: true, changed: false, ...current }),
          );
          assert.equal(unchanged.changed, false);
          assert.equal(unchanged.event, null);
          assert.equal(
            (await store.mutateSource(first.tokenHash, noOp, accept)).replayed,
            true,
          );
          assert.equal(
            (
              await store.history(first.tokenHash, {
                sourceId: "source-1",
                now,
                origin,
              })
            ).events.length,
            2,
          );
          assert.ok(!JSON.stringify(accepted).includes(first.tokenHash));
          assert.ok(
            !JSON.stringify(accepted).includes(command.intentFingerprint),
          );
          const otherOrigin = "https://preview.example";
          assert.equal(
            await store.get(first.tokenHash, now, otherOrigin),
            null,
          );
          assert.equal(
            await store.readSources(first.tokenHash, now, otherOrigin),
            null,
          );
          assert.equal(
            await store.history(first.tokenHash, {
              sourceId: "source-1",
              now,
              origin: otherOrigin,
            }),
            null,
          );
          assert.equal(
            (
              await store.mutateSource(
                first.tokenHash,
                input(2, { origin: otherOrigin }),
                accept,
              )
            ).kind,
            "expired",
          );
          assert.deepEqual(await store.remove(first.tokenHash, otherOrigin), {
            removed: false,
          });
          assert.ok(await store.get(first.tokenHash, now, origin));
        },
      );

      await t.test(
        "two connections accept one revision and duplicate requests create one receipt",
        async () => {
          const workspace = make();
          await store.create(workspace);
          const outcomes = await race(
            "SELECT id FROM showcase_visitor_workspaces WHERE id = ? FOR UPDATE",
            [workspace.id],
            (contender) => [
              contender.mutateSource(workspace.tokenHash, input(), accept),
              contender.mutateSource(workspace.tokenHash, input(), accept),
            ],
          );
          assert.deepEqual(outcomes.map((result) => result.ok).sort(), [
            false,
            true,
          ]);
          assert.equal(outcomes.find((result) => !result.ok).kind, "conflict");
          const command = input(1);
          const duplicates = await race(
            "SELECT id FROM showcase_visitor_workspaces WHERE id = ? FOR UPDATE",
            [workspace.id],
            (contender) => [
              contender.mutateSource(workspace.tokenHash, command, accept),
              contender.mutateSource(workspace.tokenHash, command, accept),
            ],
          );
          assert.ok(duplicates.every((result) => result.ok));
          assert.deepEqual(duplicates.map((result) => result.replayed).sort(), [
            false,
            true,
          ]);
          assert.equal(
            (
              await store.history(workspace.tokenHash, {
                sourceId: "source-1",
                now,
                origin,
              })
            ).events.length,
            2,
          );
        },
      );

      await t.test(
        "projection and receipt roll back together when receipt insertion fails",
        async () => {
          const workspace = make();
          await store.create(workspace);
          const failing = createWorkspaceStore(options, {
            connect: async (config) => {
              const db = await mysql.createConnection(config);
              const execute = db.execute.bind(db);
              db.execute = (sql, values) =>
                sql.startsWith("INSERT INTO showcase_workspace_receipts")
                  ? Promise.reject(new Error("Injected receipt failure"))
                  : execute(sql, values);
              return db;
            },
          });
          await assert.rejects(
            failing.mutateSource(workspace.tokenHash, input(), accept),
            /Injected receipt failure/,
          );
          assert.deepEqual(
            (await store.readSources(workspace.tokenHash, now, origin)).entries,
            [],
          );
          assert.equal(
            (await store.get(workspace.tokenHash, now, origin)).eventCount,
            0,
          );
          assert.equal(
            (
              await store.history(workspace.tokenHash, {
                sourceId: "source-1",
                now,
                origin,
              })
            ).events.length,
            0,
          );
        },
      );

      await t.test(
        "absolute expiry and removal revoke every scoped receiver and cascade records",
        async () => {
          assert.equal(
            await store.get(first.tokenHash, first.expiresAt, origin),
            null,
          );
          assert.equal(
            await store.readSources(first.tokenHash, first.expiresAt, origin),
            null,
          );
          assert.equal(
            (
              await store.mutateSource(
                first.tokenHash,
                input(2, { now: first.expiresAt }),
                accept,
              )
            ).kind,
            "expired",
          );
          assert.deepEqual(await store.remove(first.tokenHash, origin), {
            removed: true,
          });
          assert.equal(await store.get(first.tokenHash, now, origin), null);
          assert.equal(
            await store.history(first.tokenHash, {
              sourceId: "source-1",
              now,
              origin,
            }),
            null,
          );
          for (const table of [
            "showcase_workspace_sources",
            "showcase_workspace_receipts",
          ]) {
            const [[count]] = await connection.execute(
              `SELECT COUNT(*) AS total FROM ${table} WHERE workspace_id = ?`,
              [first.id],
            );
            assert.equal(count.total, 0);
          }
          assert.deepEqual(await store.remove(first.tokenHash, origin), {
            removed: false,
          });
        },
      );

      await t.test(
        "global and per-workspace quotas remain bounded under contention; expiry cleanup makes room",
        async () => {
          const workspace = make();
          await store.create(workspace);
          for (
            let revision = 0;
            revision < WORKSPACE_LIMITS.changedEvents;
            revision++
          )
            assert.equal(
              (
                await store.mutateSource(
                  workspace.tokenHash,
                  input(revision),
                  accept,
                )
              ).ok,
              true,
            );
          assert.equal(
            (await store.mutateSource(workspace.tokenHash, input(64), accept))
              .kind,
            "quota",
          );
          for (let index = 64; index < WORKSPACE_LIMITS.receipts; index++)
            assert.equal(
              (
                await store.mutateSource(
                  workspace.tokenHash,
                  input(64),
                  (current) => ({ ok: true, changed: false, ...current }),
                )
              ).ok,
              true,
            );
          assert.equal(
            (
              await store.mutateSource(
                workspace.tokenHash,
                input(64),
                (current) => ({ ok: true, changed: false, ...current }),
              )
            ).kind,
            "quota",
          );
          const [[existing]] = await connection.query(
            "SELECT COUNT(*) AS total FROM showcase_visitor_workspaces",
          );
          for (
            let index = existing.total;
            index < WORKSPACE_LIMITS.workspaces - 1;
            index++
          )
            await store.create(make());
          const simultaneous = await race(
            "SELECT singleton FROM showcase_workspace_schema WHERE singleton = 1 FOR UPDATE",
            [],
            (contender) => [contender.create(make()), contender.create(make())],
          );
          assert.deepEqual(simultaneous.map((result) => result.ok).sort(), [
            false,
            true,
          ]);
          assert.equal(simultaneous.find((result) => !result.ok).kind, "quota");
          assert.equal(
            (
              await store.create(
                make(randomUUID(), now + WORKSPACE_LIMITS.ttlMs),
              )
            ).ok,
            true,
          );
          const [[remaining]] = await connection.query(
            "SELECT COUNT(*) AS total FROM showcase_visitor_workspaces",
          );
          assert.equal(
            remaining.total,
            WORKSPACE_LIMITS.workspaces - WORKSPACE_LIMITS.cleanupBatch + 1,
          );
        },
      );

      await t.test(
        "token, source, and history access plans use their bounded indexes",
        async () => {
          const probeTime = now + WORKSPACE_LIMITS.ttlMs;
          const probe = make(randomUUID(), probeTime);
          await store.create(probe);
          await store.mutateSource(
            probe.tokenHash,
            input(0, { now: probeTime }),
            accept,
          );
          const probes = [
            [
              "SELECT id FROM showcase_visitor_workspaces WHERE token_hash = ?",
              [probe.tokenHash],
              "workspace_token",
            ],
            [
              "SELECT metadata FROM showcase_workspace_sources WHERE workspace_id = ? AND source_id = ?",
              [probe.id, "source-1"],
              "PRIMARY",
            ],
            [
              "SELECT event_id FROM showcase_workspace_receipts WHERE workspace_id = ? AND source_id = ? AND changed = 1 ORDER BY result_revision DESC LIMIT 20",
              [probe.id, "source-1"],
              "source_history",
            ],
          ];
          for (const [sql, values, key] of probes) {
            const [plan] = await connection.execute(`EXPLAIN ${sql}`, values);
            assert.equal(plan[0].key, key);
            assert.doesNotMatch(plan[0].Extra ?? "", /filesort|temporary/i);
          }
        },
      );
    } finally {
      await clear();
      for (const table of [...CATALOG_TABLES].reverse())
        await connection.query(`DROP TABLE IF EXISTS ${table}`);
      await connection.end();
    }
  },
);
