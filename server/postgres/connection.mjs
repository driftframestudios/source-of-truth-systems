import { Socket } from "node:net";
import { Client } from "pg";
import { WORKSPACE_LIMITS } from "../workspaces/limits.mjs";

const LIMITS = Object.freeze({
  connectMs: 2000,
  statementMs: 3000,
  lockMs: 1500,
  retries: 1,
});
export async function connectPostgres(options) {
  const client = new Client(options);
  // A transport loss between queries belongs to the operation's failure path.
  client.on("error", () => {});
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

/** Own the transport until cleanup settles, including a stalled query or rollback. */
function connectionScope(
  options,
  {
    signal,
    write = false,
    connect = connectPostgres,
    deadline = Date.now() + WORKSPACE_LIMITS.operationMs,
  } = {},
) {
  const socket = new Socket();
  let opening, closing, client, failure;
  const expire = (reason) => {
    failure ??=
      reason instanceof Error
        ? reason
        : new Error("Database operation cancelled.");
    socket.destroy(failure);
  };
  // The listener also covers an abort before pg has attached its protocol reader.
  socket.on("error", () => {});
  const abort = () => expire(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => expire(new Error("Database operation timed out.")),
    Math.max(1, deadline - Date.now()),
  );
  timer.unref();
  return {
    get() {
      if (closing)
        return Promise.reject(new Error("Database scope is closed."));
      opening ??= (async () => {
        if (signal?.aborted) abort();
        if (failure) throw failure;
        client = await connect({
          ...options,
          stream: socket,
          connectionTimeoutMillis: Math.min(
            options.connectionTimeoutMillis ?? LIMITS.connectMs,
            LIMITS.connectMs,
          ),
          statement_timeout: LIMITS.statementMs,
          lock_timeout: LIMITS.lockMs,
          idle_in_transaction_session_timeout: WORKSPACE_LIMITS.operationMs,
        });
        if (failure) throw failure;
        await client.query(
          write
            ? "BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE"
            : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
        );
        await client.query("SET LOCAL search_path = pg_catalog, public");
        return client;
      })();
      return opening;
    },
    close() {
      closing ??= (async () => {
        try {
          await opening?.catch(() => {});
          if (client) {
            if (!failure) await client.query("ROLLBACK").catch(() => {});
            await client.end().catch(() => {});
          }
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          socket.destroy();
          if (!socket.closed)
            await new Promise((resolve) => socket.once("close", resolve));
        }
      })();
      return closing;
    },
  };
}

export function createPostgresConnectionScope(
  options,
  signal,
  connect = connectPostgres,
) {
  return connectionScope(options, { signal, connect });
}

export async function postgresTransaction(
  options,
  work,
  { write = false, signal, connect = connectPostgres } = {},
) {
  const deadline = Date.now() + WORKSPACE_LIMITS.operationMs;
  for (let attempt = 0; ; attempt++) {
    const scope = connectionScope(options, {
      write,
      signal,
      connect,
      deadline,
    });
    try {
      const client = await scope.get();
      const result = await work(client);
      if (write) await client.query("COMMIT");
      return result;
    } catch (error) {
      // These SQL states establish a rolled-back transaction. Connection loss or
      // an uncertain commit returns to the exact-idempotency retry boundary.
      if (!(
        write &&
        attempt < LIMITS.retries &&
        ["40001", "40P01"].includes(error.code) &&
        Date.now() < deadline &&
        !signal?.aborted
      ))
        throw error;
    } finally {
      await scope.close();
    }
  }
}
