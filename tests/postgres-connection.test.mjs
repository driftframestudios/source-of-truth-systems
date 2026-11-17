import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { readDatabaseConfig } from "../server/data/database-config.mjs";
import {
  createPostgresConnectionScope,
  postgresTransaction,
} from "../server/postgres/connection.mjs";

const env = {
  DATABASE_PROVIDER: "postgres",
  PGHOST: "localhost",
  PGDATABASE: "example",
  PGUSER: "example",
  PGPASSWORD: "test-only",
};
test("provider selection retains MySQL and admits only a complete, explicit PostgreSQL configuration", () => {
  assert.deepEqual(readDatabaseConfig({}), { mode: "example" });
  const postgres = readDatabaseConfig(env);
  assert.equal(postgres.mode, "postgres");
  assert.equal(postgres.options.port, 5432);
  assert.equal(postgres.options.ssl.rejectUnauthorized, true);
  assert.equal(
    readDatabaseConfig({ ...env, PGSSLMODE: "disable" }).options.ssl,
    false,
  );
  const mysql = {
    DB_HOST: "localhost",
    DB_NAME: "example",
    DB_USER: "example",
    DB_PASSWORD: "test-only",
  };
  assert.equal(readDatabaseConfig(mysql).mode, "mysql");
  for (const invalid of [
    { ...env, DATABASE_PROVIDER: "" },
    { ...env, PGUSER: "" },
    { ...env, ...mysql },
    { ...mysql, DATABASE_PROVIDER: "example" },
    { ...env, PGSSLMODE: "require" },
    { ...env, PGPORT: "5432extra" },
  ])
    assert.throws(() => readDatabaseConfig(invalid));
});

test("transient SQL failure retries the entire write; an uncertain commit preserves the original retry boundary", async () => {
  const queries = [];
  let opens = 0,
    workCalls = 0;
  const connect = async () => {
    const id = ++opens;
    return {
      query: async (sql) => {
        queries.push([id, sql]);
      },
      end: async () => queries.push([id, "END"]),
    };
  };
  const result = await postgresTransaction(
    {},
    async () => {
      if (++workCalls === 1)
        throw Object.assign(new Error("serialization"), { code: "40001" });
      return "accepted";
    },
    { write: true, connect },
  );
  assert.equal(result, "accepted");
  assert.equal(opens, 2);
  assert.ok(queries.find(([id, sql]) => id === 1 && sql === "ROLLBACK"));
  assert.ok(queries.find(([id, sql]) => id === 2 && sql === "COMMIT"));
  let uncertainOpens = 0;
  await assert.rejects(
    postgresTransaction({}, async () => "applied", {
      write: true,
      connect: async () => {
        uncertainOpens++;
        return {
          query: async (sql) => {
            if (sql === "COMMIT")
              throw Object.assign(new Error("connection lost"), {
                code: "08006",
              });
          },
          end: async () => {},
        };
      },
    }),
    /connection lost/,
  );
  assert.equal(uncertainOpens, 1);
});

test(
  "cancellation closes a real PostgreSQL driver stalled in its handshake",
  { timeout: 3000 },
  async (t) => {
    let accept;
    const accepted = new Promise((resolve) => {
      accept = resolve;
    });
    const peers = new Set();
    const server = createServer((socket) => {
      peers.add(socket);
      socket.on("close", () => peers.delete(socket));
      accept();
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(async () => {
      for (const socket of peers) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    });
    const controller = new AbortController();
    const scope = createPostgresConnectionScope(
      {
        host: "127.0.0.1",
        port: server.address().port,
        user: "example",
        database: "example",
        password: "test-only",
        ssl: false,
      },
      controller.signal,
    );
    const opening = scope.get();
    await accepted;
    controller.abort(new Error("Visitor left the history"));
    await assert.rejects(opening, /Visitor left/);
    await Promise.all([scope.close(), scope.close()]);
    await assert.rejects(scope.get(), /closed/);
  },
);
