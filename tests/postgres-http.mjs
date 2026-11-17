import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { fixture } from "./server-fixture.mjs";
import { initializePostgresCatalog } from "../server/data/postgres-initialize.mjs";
import { initializePostgresWorkspaces } from "../server/workspaces/postgres-initialize.mjs";
import { CATALOG_TABLES } from "../server/data/catalog-schema.mjs";
import { WORKSPACE_TABLES } from "../server/workspaces/postgres-schema.mjs";
import { PLATE_HISTORY_HASH } from "../shared/plate-history-operation.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";
import {
  exampleData,
  prepareSourceCommand,
} from "../build/server/example-data.mjs";

async function startServer(t, env, port = "0") {
  const server = await fixture(t, { env, port });
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Production HTTP fixture did not become ready.")),
      5000,
    );
    const ready = () => {
      const match = server
        .output()
        .match(/Serving production build on port (\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    };
    server.child.stdout.on("data", ready);
    server.exited.then(() => {
      clearTimeout(timeout);
      reject(new Error("Production HTTP fixture exited before readiness."));
    });
    ready();
  });
  return {
    ...server,
    base,
    stop: async () => {
      if (server.child.exitCode === null && server.child.signalCode === null)
        server.child.kill();
      await server.exited;
    },
  };
}

test(
  "production PostgreSQL HTTP preserves scoped catalog and Source receipts across a same-origin application restart",
  { skip: process.env.POSTGRES_TEST !== "1", timeout: 30000 },
  async (t) => {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.PGHOST));
    assert.match(
      process.env.PGDATABASE ?? "",
      /^sot_[a-z0-9_]+_(?:test|proof)$/,
    );
    const runtimeUser = process.env.PGRUNTIMEUSER || process.env.PGUSER;
    assert.match(runtimeUser ?? "", /^[a-z][a-z0-9_]*$/);
    const setup = new Client({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE,
      user: process.env.PGSETUPUSER || process.env.PGUSER,
      password: process.env.PGSETUPPASSWORD || process.env.PGPASSWORD,
    });
    await setup.connect();
    t.after(() => setup.end());
    await initializePostgresCatalog(setup, exampleData);
    await initializePostgresWorkspaces(setup);
    for (const name of CATALOG_TABLES)
      await setup.query(`GRANT SELECT ON public.${name} TO "${runtimeUser}"`);
    await setup.query(
      `GRANT SELECT, UPDATE (singleton) ON public.showcase_workspace_schema TO "${runtimeUser}"`,
    );
    for (const name of WORKSPACE_TABLES.slice(1))
      await setup.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${name} TO "${runtimeUser}"`,
      );
    const options = {
      DATABASE_PROVIDER: "postgres",
      PGHOST: process.env.PGHOST,
      PGPORT: process.env.PGPORT || "5432",
      PGDATABASE: process.env.PGDATABASE,
      PGUSER: runtimeUser,
      PGPASSWORD: process.env.PGRUNTIMEPASSWORD || process.env.PGPASSWORD,
      PGSSLMODE: "disable",
    };
    const result = exampleData.results.find(
      (entry) => entry.wellId === "C3" && entry.seq === 0,
    );
    const {
      rows: [stored],
    } = await setup.query(
      "SELECT metadata FROM public.showcase_results WHERE id = $1",
      [result.id],
    );
    const storedTitle =
      "PostgreSQL history retained across application restart";
    await setup.query(
      "UPDATE public.showcase_results SET metadata = jsonb_set(metadata, '{title}', to_jsonb($1::text)) WHERE id = $2",
      [storedTitle, result.id],
    );
    const { operations } = createWorkspaceApi({
      data: exampleData,
      prepareSourceCommand,
    });
    const hashes = new Map(
      operations.map((operation) => [operation.name, operation.sha256Hash]),
    );
    const cookies = [];
    const workspaceIds = [];
    let server;
    async function call(name, variables = {}, cookie) {
      const response = await fetch(`${server.base}/workspace/graphql`, {
        method: "POST",
        headers: {
          origin: server.base,
          "content-type": "application/json",
          "x-sot-workspace": "1",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({
          operationName: name,
          variables,
          extensions: {
            persistedQuery: { version: 1, sha256Hash: hashes.get(name) },
          },
        }),
      });
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.equal(body.errors, undefined);
      return {
        value: Object.values(body.data)[0],
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    }
    async function readHistory() {
      const response = await fetch(`${server.base}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          extensions: {
            persistedQuery: { version: 1, sha256Hash: PLATE_HISTORY_HASH },
          },
          variables: { plateId: exampleData.plateId, id: "C3" },
        }),
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.errors, undefined);
      assert.equal(body.data.dataSource.mode, "STORED");
      const history = body.data.well.history.edges.map(({ node }) => node);
      assert.equal(history[0].title, storedTitle);
      assert.equal(history[1].supersedes.id, history[0].id);
      const file = history[0].artifacts.edges.find(
        ({ node }) => node.file.kind === "bam",
      ).node.file;
      const reused = history[1].artifacts.edges.find(
        ({ node }) => node.file.kind === "bam",
      ).node;
      assert.equal(reused.file.id, file.id);
      assert.equal(reused.reusedFrom.id, history[0].id);
    }
    try {
      server = await startServer(t, options);
      await readHistory();
      for (let index = 0; index < 2; index++) {
        const started = await call("StartWorkspace");
        assert.equal(started.value.code, "OK");
        assert.ok(started.cookie);
        cookies.push(started.cookie);
        workspaceIds.push(started.value.workspace.id);
      }
      const original = exampleData.sources.find(
        (source) => source.id === "yaml_context",
      );
      const input = {
        id: original.id,
        expectedRevision: 0,
        idempotencyKey: randomUUID(),
        metadata: {
          title: "<img src=x> — Génome 🧬",
          description: "SELECT remains documentary text; 患者の記録.",
          tags: ["pipeline", "🧪"],
        },
      };
      const accepted = (await call("SaveSource", { input }, cookies[0])).value;
      assert.equal(accepted.code, "OK");
      assert.equal(accepted.source.revision, 1);
      assert.equal(accepted.source.title, input.metadata.title);
      assert.equal(
        (await call("WorkspaceSource", { id: original.id }, cookies[1])).value
          .source.title,
        original.title,
      );
      const port = new URL(server.base).port;
      const priorPid = server.child.pid;
      await server.stop();
      server = await startServer(t, options, port);
      assert.notEqual(server.child.pid, priorPid);
      await readHistory();
      const fresh = (
        await call("WorkspaceSource", { id: original.id }, cookies[0])
      ).value;
      assert.equal(fresh.code, "OK");
      assert.equal(fresh.source.title, input.metadata.title);
      const replay = (await call("SaveSource", { input }, cookies[0])).value;
      assert.equal(replay.code, "OK");
      assert.equal(replay.replayed, true);
      assert.deepEqual(replay.source, accepted.source);
      const unsupported = {
        ...input,
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        metadata: {
          ...input.metadata,
          description: "Keep this draft\u0000until corrected",
        },
      };
      const beforeInvalid = JSON.stringify(unsupported);
      assert.equal(
        (await call("SaveSource", { input: unsupported }, cookies[0])).value
          .code,
        "INVALID",
      );
      assert.equal(JSON.stringify(unsupported), beforeInvalid);
      const retained = (
        await call("WorkspaceSource", { id: original.id }, cookies[0])
      ).value.source;
      assert.equal(retained.description, input.metadata.description);
      assert.equal(retained.revision, 1);
      const history = (
        await call("WorkspaceHistory", { sourceId: original.id }, cookies[0])
      ).value;
      assert.equal(history.events.length, 1);
      assert.equal(history.events[0].resultRevision, 1);
      assert.equal(
        (await call("WorkspaceSource", { id: original.id }, cookies[1])).value
          .source.title,
        original.title,
      );
      assert.equal(
        (await call("ResetWorkspace", {}, cookies[0])).value.code,
        "ABSENT",
      );
      assert.equal(
        (await call("WorkspaceSource", { id: original.id }, cookies[0])).value
          .code,
        "EXPIRED",
      );
      assert.equal(
        (await call("WorkspaceStatus", {}, cookies[1])).value.code,
        "OK",
      );
    } finally {
      try {
        if (
          server &&
          server.child.exitCode === null &&
          server.child.signalCode === null
        ) {
          try {
            for (const cookie of cookies)
              await call("ResetWorkspace", {}, cookie);
          } finally {
            await server.stop();
          }
        }
      } finally {
        try {
          await setup.query(
            "DELETE FROM public.showcase_visitor_workspaces WHERE id = ANY($1::varchar[])",
            [workspaceIds],
          );
        } finally {
          await setup.query(
            "UPDATE public.showcase_results SET metadata = $1 WHERE id = $2",
            [JSON.stringify(stored.metadata), result.id],
          );
        }
      }
    }
  },
);
