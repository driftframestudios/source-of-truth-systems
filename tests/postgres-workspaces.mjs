import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { Client } from "pg";
import { initializePostgresWorkspaces } from "../server/workspaces/postgres-initialize.mjs";
import { createPostgresWorkspaceStore } from "../server/workspaces/postgres-store.mjs";
import {
  WORKSPACE_TABLES,
  existingPostgresWorkspaceTables,
} from "../server/workspaces/postgres-schema.mjs";
import { WORKSPACE_LIMITS } from "../server/workspaces/limits.mjs";

const enabled = process.env.POSTGRES_TEST === "1";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const actor = { principalId: "scientist", roleId: "admin", environment: "DEV" };
const record = {
  title: "Génome 🧬",
  description: "患者の記録 — α",
  tags: ["genomics", "🧪"],
};
const now = Date.UTC(2026, 10, 17);
const origin = "http://127.0.0.1:3200";
const make = (at = now) => ({
  id: randomUUID(),
  tokenHash: hash(randomUUID()),
  now: at,
  expiresAt: at + WORKSPACE_LIMITS.ttlMs,
  origin,
});
const input = (revision = 0, extra = {}) => ({
  idempotencyKey: randomUUID(),
  intentFingerprint: hash(randomUUID()),
  sourceId: "Source-A",
  now,
  origin,
  actor,
  command: { type: "save", revision, metadata: record },
  ...extra,
});
const accept = (current) => ({
  ok: true,
  changed: true,
  record,
  revision: (current?.revision ?? 0) + 1,
});
const unchanged = (current) => ({
  ok: true,
  changed: false,
  record: current?.record ?? record,
  revision: current?.revision ?? 0,
});

test(
  "PostgreSQL workspace ownership, migration and receipt contracts",
  { skip: !enabled, timeout: 60000 },
  async (t) => {
    assert.ok(
      ["127.0.0.1", "localhost", "::1"].includes(process.env.PGHOST),
      "Use an explicitly selected loopback fixture.",
    );
    assert.match(
      process.env.PGDATABASE ?? "",
      /^sot_[a-z0-9_]+_(?:test|proof)$/,
    );
    assert.ok(
      process.env.PGUSER,
      "Choose the fixture's ordinary runtime role.",
    );
    const options = {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGRUNTIMEUSER || process.env.PGUSER,
      password: process.env.PGRUNTIMEPASSWORD || process.env.PGPASSWORD,
      connectionTimeoutMillis: 2000,
    };
    const connect = async (config = options) => {
      const client = new Client(config);
      await client.connect();
      return client;
    };
    const setup = await connect({
      ...options,
      user: process.env.PGSETUPUSER || options.user,
      password: process.env.PGSETUPPASSWORD || options.password,
    });
    t.after(() => setup.end());
    const store = createPostgresWorkspaceStore(options);
    const clear = async () => {
      for (const name of [...WORKSPACE_TABLES].reverse())
        await setup.query(`DROP TABLE IF EXISTS public.${name}`);
    };
    const grantRuntime = async () => {
      if (!process.env.PGSETUPUSER || process.env.PGSETUPUSER === options.user)
        return;
      assert.match(options.user, /^[a-z][a-z0-9_]*$/);
      await setup.query(
        `GRANT SELECT, UPDATE (singleton) ON public.showcase_workspace_schema TO "${options.user}"`,
      );
      for (const name of WORKSPACE_TABLES.slice(1))
        await setup.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${name} TO "${options.user}"`,
        );
    };
    const race = async (lockSql, values, submit) => {
      await setup.query("BEGIN");
      await setup.query(lockSql, values);
      let entered = 0,
        release;
      const queued = new Promise((resolve) => {
        release = resolve;
      });
      const contenders = createPostgresWorkspaceStore(options, {
        connect: async (config) => {
          const client = await connect(config),
            query = client.query.bind(client);
          client.query = (sql, ...args) => {
            const result = query(sql, ...args);
            if (sql.includes("FOR UPDATE") && ++entered === 2) release();
            return result;
          };
          return client;
        },
      });
      const pending = submit(contenders);
      try {
        await queued;
        await setup.query("COMMIT");
        return await Promise.all(pending);
      } finally {
        await setup.query("ROLLBACK");
      }
    };
    await clear();
    try {
      await t.test(
        "initializer rolls back interrupted DDL and concurrent setup accepts one installation",
        async () => {
          assert.deepEqual(await store.status(), {
            available: false,
            mode: "local",
          });
          const interrupted = {
            query: (sql, ...args) => {
              if (
                sql.startsWith("INSERT INTO public.showcase_workspace_schema")
              )
                throw new Error("Interrupted marker write");
              return setup.query(sql, ...args);
            },
          };
          await assert.rejects(
            initializePostgresWorkspaces(interrupted),
            /Interrupted marker/,
          );
          assert.equal((await existingPostgresWorkspaceTables(setup)).size, 0);
          const first = await connect({
            ...options,
            user: process.env.PGSETUPUSER || options.user,
            password: process.env.PGSETUPPASSWORD || options.password,
          });
          const second = await connect({
            ...options,
            user: process.env.PGSETUPUSER || options.user,
            password: process.env.PGSETUPPASSWORD || options.password,
          });
          try {
            await setup.query("BEGIN");
            await setup.query("SELECT pg_advisory_xact_lock(1936684103, 2)");
            let entered = 0,
              release;
            const queued = new Promise((resolve) => {
              release = resolve;
            });
            for (const client of [first, second]) {
              await client.query(
                "SET default_transaction_isolation = 'repeatable read'",
              );
              const query = client.query.bind(client);
              client.query = (sql, ...args) => {
                const pending = query(sql, ...args);
                if (sql.includes("pg_advisory_xact_lock") && ++entered === 2)
                  release();
                return pending;
              };
            }
            const pending = Promise.all([
              initializePostgresWorkspaces(first),
              initializePostgresWorkspaces(second),
            ]);
            await queued;
            await setup.query("COMMIT");
            const results = await pending;
            assert.deepEqual(
              results.map((result) => result.initialized).sort(),
              [false, true],
            );
          } finally {
            await setup.query("ROLLBACK");
            await Promise.all([first.end(), second.end()]);
          }
          await grantRuntime();
          assert.deepEqual(await store.status(), {
            available: true,
            mode: "stored",
          });
          const ordinary = await connect();
          try {
            const {
              rows: [role],
            } = await ordinary.query(
              "SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user",
            );
            assert.equal(role.rolsuper, false);
            await assert.rejects(
              ordinary.query(
                "INSERT INTO public.showcase_workspace_sources VALUES ($1, 'orphan', 1, '{}'::jsonb)",
                [randomUUID()],
              ),
              { code: "23503" },
            );
          } finally {
            await ordinary.end();
          }
        },
      );

      const first = make(),
        second = make();
      await store.create(first);
      await store.create(second);
      await t.test(
        "save, exact retry, no-op and restore retain identity across fresh clients",
        async () => {
          const command = input();
          const saved = await store.mutateSource(
            first.tokenHash,
            command,
            accept,
          );
          assert.equal(saved.ok, true);
          assert.equal(saved.entry.revision, 1);
          assert.deepEqual(saved.entry.record, record);
          assert.deepEqual(
            (await store.readSources(second.tokenHash, now, origin)).entries,
            [],
          );
          assert.equal(
            (await store.mutateSource(first.tokenHash, input(), accept)).kind,
            "conflict",
          );
          assert.equal(
            (
              await store.mutateSource(first.tokenHash, input(1), () => ({
                ok: false,
                kind: "role",
                reason: "Role cannot edit.",
              }))
            ).kind,
            "role",
          );
          const later = { ...record, title: "Later accepted source" };
          await store.mutateSource(first.tokenHash, input(1), (current) => ({
            ...accept(current),
            record: later,
          }));
          const fresh = createPostgresWorkspaceStore(options);
          const replay = await fresh.mutateSource(
            first.tokenHash,
            command,
            () => {
              throw new Error("Exact retry must read its receipt.");
            },
          );
          assert.equal(replay.replayed, true);
          assert.deepEqual(replay.entry, saved.entry);
          assert.deepEqual(replay.event, saved.event);
          assert.equal(
            (await fresh.readSources(first.tokenHash, now, origin)).entries[0]
              .record.title,
            later.title,
          );
          assert.equal(
            (
              await store.mutateSource(
                first.tokenHash,
                { ...command, intentFingerprint: hash("changed-intent") },
                accept,
              )
            ).kind,
            "conflict",
          );
          const noop = input(2),
            noopResult = await store.mutateSource(
              first.tokenHash,
              noop,
              unchanged,
            );
          assert.equal(noopResult.changed, false);
          assert.equal(noopResult.event, null);
          assert.deepEqual(
            (await store.mutateSource(first.tokenHash, noop, accept)).entry,
            noopResult.entry,
          );
          const restore = input(2, {
            command: { type: "restore", revision: 2 },
          });
          const restored = await store.mutateSource(
            first.tokenHash,
            restore,
            accept,
          );
          assert.equal(restored.event.action, "restore");
          assert.deepEqual(
            (
              await store.history(first.tokenHash, {
                sourceId: "Source-A",
                now,
                origin,
              })
            ).events.map((event) => event.resultRevision),
            [3, 2, 1],
          );
          await store.mutateSource(
            first.tokenHash,
            input(0, { sourceId: "source-a" }),
            accept,
          );
          assert.equal(
            (await store.readSources(first.tokenHash, now, origin)).entries
              .length,
            2,
            "case-distinct source identities remain separate",
          );
          assert.equal(
            await store.get(first.tokenHash, now, "http://127.0.0.1:3201"),
            null,
          );
          assert.equal(
            (
              await store.mutateSource(
                first.tokenHash,
                input(3, { origin: "http://127.0.0.1:3201" }),
                accept,
              )
            ).kind,
            "expired",
          );
          assert.deepEqual(
            await store.remove(first.tokenHash, "http://127.0.0.1:3201"),
            { removed: false },
          );
          assert.equal(JSON.stringify(saved).includes(first.tokenHash), false);
          assert.equal(
            JSON.stringify(saved).includes(command.intentFingerprint),
            false,
          );
          assert.equal(
            (await initializePostgresWorkspaces(setup)).initialized,
            false,
          );
          assert.equal(
            (await store.readSources(first.tokenHash, now, origin)).entries
              .length,
            2,
          );
        },
      );

      await t.test(
        "ownership locks choose one stale-revision winner and one receipt for simultaneous exact retries",
        async () => {
          const workspace = make();
          await store.create(workspace);
          const sql =
            "SELECT id FROM public.showcase_visitor_workspaces WHERE id = $1 FOR UPDATE";
          const outcomes = await race(sql, [workspace.id], (contender) => [
            contender.mutateSource(workspace.tokenHash, input(), accept),
            contender.mutateSource(workspace.tokenHash, input(), accept),
          ]);
          assert.deepEqual(outcomes.map((value) => value.ok).sort(), [
            false,
            true,
          ]);
          assert.equal(outcomes.find((value) => !value.ok).kind, "conflict");
          const command = input(1);
          const duplicates = await race(sql, [workspace.id], (contender) => [
            contender.mutateSource(workspace.tokenHash, command, accept),
            contender.mutateSource(workspace.tokenHash, command, accept),
          ]);
          assert.ok(duplicates.every((value) => value.ok));
          assert.deepEqual(duplicates.map((value) => value.replayed).sort(), [
            false,
            true,
          ]);
          assert.equal(
            (
              await store.history(workspace.tokenHash, {
                sourceId: "Source-A",
                now,
                origin,
              })
            ).events.length,
            2,
          );
        },
      );

      await t.test(
        "failed receipt insertion rolls back projection and recovers with the original intent",
        async () => {
          const workspace = make();
          await store.create(workspace);
          const command = input();
          const failing = createPostgresWorkspaceStore(options, {
            connect: async (config) => {
              const client = await connect(config),
                query = client.query.bind(client);
              client.query = (sql, ...args) => {
                if (
                  sql.startsWith(
                    "INSERT INTO public.showcase_workspace_receipts",
                  )
                )
                  return query("SELECT 1 / 0");
                return query(sql, ...args);
              };
              return client;
            },
          });
          await assert.rejects(
            failing.mutateSource(workspace.tokenHash, command, accept),
            { code: "22012" },
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
            (await store.mutateSource(workspace.tokenHash, command, accept))
              .entry.revision,
            1,
          );
          assert.equal(
            (await store.create(workspace)).kind,
            "conflict",
            "a duplicate returns a typed refusal without an aborted transaction",
          );
          assert.ok(await store.get(workspace.tokenHash, now, origin));
          assert.equal(
            await store.get(workspace.tokenHash, workspace.expiresAt, origin),
            null,
          );
          assert.equal(
            (
              await store.mutateSource(
                workspace.tokenHash,
                input(1, { now: workspace.expiresAt }),
                accept,
              )
            ).kind,
            "expired",
          );
          assert.deepEqual(await store.remove(workspace.tokenHash, origin), {
            removed: true,
          });
          const {
            rows: [left],
          } = await setup.query(
            "SELECT count(*) AS total FROM public.showcase_workspace_receipts WHERE workspace_id = $1",
            [workspace.id],
          );
          assert.equal(Number(left.total), 0);
        },
      );

      await t.test(
        "receipt and changed-event caps retain exact retries and unchanged acceptance",
        async () => {
          const workspace = make();
          await store.create(workspace);
          await setup.query(
            `INSERT INTO public.showcase_workspace_receipts
        (workspace_id,idempotency_key,intent_fingerprint,event_id,source_id,action,payload_version,command_payload,actor,accepted_ms,expected_revision,result_revision,changed,result_metadata)
        SELECT $1, 'seed-' || n, $2, gen_random_uuid()::text, 'Source-A', 'save', 1, '{}'::jsonb, $3::jsonb, $4, n-1, n, 1, $5::jsonb FROM generate_series(1,64) n`,
            [
              workspace.id,
              hash("seed"),
              JSON.stringify(actor),
              now,
              JSON.stringify(record),
            ],
          );
          await setup.query(
            "INSERT INTO public.showcase_workspace_sources VALUES ($1, 'Source-A', 64, $2)",
            [workspace.id, JSON.stringify(record)],
          );
          await setup.query(
            "UPDATE public.showcase_visitor_workspaces SET changed_count = 64, receipt_count = 64 WHERE id = $1",
            [workspace.id],
          );
          assert.equal(
            (await store.mutateSource(workspace.tokenHash, input(64), accept))
              .kind,
            "quota",
          );
          const command = input(64);
          assert.equal(
            (await store.mutateSource(workspace.tokenHash, command, unchanged))
              .changed,
            false,
          );
          await setup.query(
            `INSERT INTO public.showcase_workspace_receipts
        (workspace_id,idempotency_key,intent_fingerprint,event_id,source_id,action,payload_version,command_payload,actor,accepted_ms,expected_revision,result_revision,changed,result_metadata)
        SELECT $1, 'unchanged-' || n, $2, gen_random_uuid()::text, 'Source-A', 'save', 1, '{}'::jsonb, $3::jsonb, $4, 64, 64, 0, $5::jsonb FROM generate_series(1,63) n`,
            [
              workspace.id,
              hash("seed"),
              JSON.stringify(actor),
              now,
              JSON.stringify(record),
            ],
          );
          await setup.query(
            "UPDATE public.showcase_visitor_workspaces SET receipt_count = 128 WHERE id = $1",
            [workspace.id],
          );
          assert.equal(
            (
              await store.mutateSource(
                workspace.tokenHash,
                input(64),
                unchanged,
              )
            ).kind,
            "quota",
          );
          assert.equal(
            (await store.mutateSource(workspace.tokenHash, command, accept))
              .replayed,
            true,
          );
          assert.equal(
            (
              await store.history(workspace.tokenHash, {
                sourceId: "Source-A",
                now,
                origin,
              })
            ).events.length,
            20,
          );
        },
      );

      await t.test(
        "ordinary-role token, source and history plans retain bounded returns",
        async () => {
          const client = await connect();
          try {
            for (const [operation, sql, values, expectedRows] of [
              [
                "workspace token",
                "SELECT id FROM public.showcase_visitor_workspaces WHERE token_hash=$1 AND origin=$2",
                [first.tokenHash, origin],
                1,
              ],
              [
                "source projection",
                "SELECT revision, metadata FROM public.showcase_workspace_sources WHERE workspace_id=$1 AND source_id=$2",
                [first.id, "Source-A"],
                1,
              ],
              [
                "source history",
                "SELECT result_revision FROM public.showcase_workspace_receipts WHERE workspace_id=$1 AND source_id=$2 AND changed=1 ORDER BY result_revision DESC LIMIT 20",
                [first.id, "Source-A"],
                3,
              ],
            ]) {
              const { rows } = await client.query(
                `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
                values,
              );
              const plan = rows[0]["QUERY PLAN"][0].Plan;
              assert.equal(plan["Actual Rows"], expectedRows);
              assert.equal(plan["Actual Loops"], 1);
              t.diagnostic(
                `${operation}: ${plan["Actual Rows"]} rows, ${plan["Actual Loops"]} loop, root ${plan["Node Type"]}; tiny fixture planner choice remains observational`,
              );
            }
          } finally {
            await client.end();
          }
        },
      );

      await t.test(
        "global admission serializes at the last slot and cleanup stays bounded",
        async () => {
          await setup.query("DELETE FROM public.showcase_visitor_workspaces");
          await setup.query(
            `INSERT INTO public.showcase_visitor_workspaces(id, token_hash, origin, created_ms, expires_ms)
        SELECT gen_random_uuid()::text, md5(n::text) || md5(n::text), $1, $2::bigint, $2::bigint + 86400000 FROM generate_series(1,127) n`,
            [origin, now],
          );
          const results = await race(
            "SELECT singleton FROM public.showcase_workspace_schema WHERE singleton=1 FOR UPDATE",
            [],
            (contender) => [contender.create(make()), contender.create(make())],
          );
          assert.deepEqual(results.map((value) => value.ok).sort(), [
            false,
            true,
          ]);
          assert.equal(results.find((value) => !value.ok).kind, "quota");
          const next = now + WORKSPACE_LIMITS.ttlMs;
          assert.equal((await store.create(make(next))).ok, true);
          const {
            rows: [count],
          } = await setup.query(
            "SELECT count(*) AS total FROM public.showcase_visitor_workspaces",
          );
          assert.equal(
            Number(count.total),
            128 - WORKSPACE_LIMITS.cleanupBatch + 1,
          );
        },
      );

      await t.test(
        "schema drift and partial or future state refuse normal operation while records remain available for repair",
        async () => {
          await setup.query(
            "ALTER TABLE public.showcase_workspace_sources DROP CONSTRAINT workspace_source_owner",
          );
          assert.deepEqual(await store.status(), {
            available: false,
            mode: "unavailable",
          });
          await assert.rejects(initializePostgresWorkspaces(setup), {
            code: "WORKSPACE_SCHEMA_UNAVAILABLE",
          });
          await setup.query(
            "ALTER TABLE public.showcase_workspace_sources ADD CONSTRAINT workspace_source_owner FOREIGN KEY (workspace_id) REFERENCES public.showcase_visitor_workspaces(id) ON DELETE CASCADE",
          );
          assert.deepEqual(await store.status(), {
            available: true,
            mode: "stored",
          });
          await setup.query(
            "UPDATE public.showcase_workspace_schema SET schema_version = 2",
          );
          await assert.rejects(initializePostgresWorkspaces(setup), {
            code: "WORKSPACE_SCHEMA_UNAVAILABLE",
          });
          await clear();
          await setup.query(
            "CREATE TABLE public.showcase_workspace_schema (foreign_record text)",
          );
          await setup.query(
            "INSERT INTO public.showcase_workspace_schema VALUES ('Keep for explicit recovery')",
          );
          await assert.rejects(initializePostgresWorkspaces(setup), {
            code: "WORKSPACE_SCHEMA_UNAVAILABLE",
          });
          assert.equal(
            (
              await setup.query(
                "SELECT * FROM public.showcase_workspace_schema",
              )
            ).rows[0].foreign_record,
            "Keep for explicit recovery",
          );
        },
      );
    } finally {
      await clear();
    }
  },
);
