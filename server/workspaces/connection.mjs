import mysql from "mysql2/promise";
import { createConnection } from "node:net";
import { WORKSPACE_LIMITS } from "./limits.mjs";

/** One operation owns its transaction and transport, including an uncertain commit. */
export async function workspaceTransaction(
  options,
  work,
  { connect = mysql.createConnection, write = false } = {},
) {
  let connection,
    socket,
    expired = false;
  const timer = setTimeout(() => {
    expired = true;
    if (socket)
      socket.destroy(new Error("Visitor workspace operation timed out."));
    else connection?.destroy();
  }, WORKSPACE_LIMITS.operationMs);
  timer.unref();
  try {
    connection = await connect({
      ...options,
      connectTimeout: Math.min(options.connectTimeout ?? 2000, 2000),
      multipleStatements: false,
      stream: () => {
        socket = createConnection(
          options.socketPath
            ? { path: options.socketPath }
            : { host: options.host, port: options.port ?? 3306 },
        );
        return socket;
      },
    });
    if (expired) throw new Error("Visitor workspace operation timed out.");
    await connection.query("SET SESSION innodb_lock_wait_timeout = 2");
    // Commands waiting for an ownership lock must read the receipt/quota committed
    // by its previous holder, rather than an earlier admission snapshot.
    await connection.query(
      write
        ? "SET TRANSACTION ISOLATION LEVEL READ COMMITTED, READ WRITE"
        : "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
    );
    await connection.beginTransaction();
    const result = await work(connection);
    if (write) await connection.commit();
    else await connection.rollback();
    return result;
  } catch (error) {
    if (connection && !expired) {
      try {
        await connection.rollback();
      } catch {
        /* The original error owns the failure. */
      }
    }
    throw error;
  } finally {
    try {
      if (connection && !expired) await connection.end();
    } finally {
      clearTimeout(timer);
      socket?.destroy();
      if (!socket) connection?.destroy();
    }
  }
}
