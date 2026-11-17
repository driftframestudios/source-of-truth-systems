import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import mysql from "mysql2";
import { createConnectionScope } from "../server/data/connection.mjs";

async function fixture(t, onQuery) {
  const sockets = new Set();
  let connected;
  const accepted = new Promise((resolve) => {
    connected = resolve;
  });
  const receive = (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    connected();
  };
  // A local protocol peer exercises the real driver without requiring a database.
  const server = onQuery
    ? mysql.createServer((connection) => {
        receive(connection.stream);
        connection.on("error", () => {});
        connection.serverHandshake({
          protocolVersion: 10,
          serverVersion: "8.0.0-test",
          connectionId: 1,
          statusFlags: 2,
          characterSet: 45,
          capabilityFlags: 0xf7ff,
          authCallback(_credentials, done) {
            done(null);
            connection._resetSequenceId();
          },
        });
        // The driver's minimal server API leaves per-command sequence reset to its peer.
        connection.on("packet", () => connection._resetSequenceId());
        connection.on("stmt_prepare", (sql) => onQuery(sql, connection));
        connection.on("query", (sql) => onQuery(sql, connection));
      })
    : createServer(receive);
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = onQuery ? server._server.address() : server.address();
  return {
    accepted,
    options: {
      host: "127.0.0.1",
      port: address.port,
      user: "test",
      connectTimeout: 500,
    },
  };
}

test(
  "a read scope reuses one connection and closes its transaction and transport once",
  { timeout: 2000 },
  async (t) => {
    const seen = [];
    const { options } = await fixture(t, (sql, connection) => {
      seen.push(sql);
      connection.writeOk();
    });
    const scope = createConnectionScope(options, new AbortController().signal);
    const connection = await scope.get();
    assert.equal(await scope.get(), connection);
    await connection.query("SELECT 1");
    await Promise.all([scope.close(), scope.close()]);
    assert.deepEqual(seen, [
      "SET TRANSACTION READ ONLY",
      "START TRANSACTION",
      "SELECT 1",
      "ROLLBACK",
    ]);
    assert.equal(connection.connection.stream.destroyed, true);
    await assert.rejects(scope.get(), /closed/);
  },
);

test(
  "aborting a pending SQL read rejects the command and releases its socket",
  { timeout: 2000 },
  async (t) => {
    let reached;
    const pending = new Promise((resolve) => {
      reached = resolve;
    });
    const { options } = await fixture(t, (sql, connection) => {
      if (sql === "SELECT 1") reached();
      else connection.writeOk();
    });
    const controller = new AbortController();
    const scope = createConnectionScope(options, controller.signal);
    const connection = await scope.get();
    const reading = connection.query("SELECT 1");
    await pending;
    controller.abort(new Error("Cancelled selected history"));
    await assert.rejects(reading, /Cancelled selected history/);
    await scope.close();
    assert.equal(connection.connection.stream.destroyed, true);
  },
);

test(
  "abort remains active through a stalled handshake and through transaction cleanup",
  { timeout: 2000 },
  async (t) => {
    const handshake = await fixture(t);
    const connecting = new AbortController();
    const openingScope = createConnectionScope(
      handshake.options,
      connecting.signal,
    );
    const opening = openingScope.get();
    await handshake.accepted;
    connecting.abort(new Error("Handshake cancelled"));
    await assert.rejects(opening, /Handshake cancelled/);
    await openingScope.close();

    let reached;
    const rollback = new Promise((resolve) => {
      reached = resolve;
    });
    const { options } = await fixture(t, (sql, connection) => {
      if (sql === "ROLLBACK") reached();
      else connection.writeOk();
    });
    const controller = new AbortController();
    const scope = createConnectionScope(options, controller.signal);
    const connection = await scope.get();
    const closing = scope.close();
    await rollback;
    controller.abort(new Error("Cleanup cancelled"));
    await closing;
    assert.equal(connection.connection.stream.destroyed, true);
  },
);
