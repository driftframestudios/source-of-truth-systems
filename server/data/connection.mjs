import mysql from "mysql2/promise";
import { createConnection } from "node:net";

export { readDatabaseConfig } from "./database-config.mjs";

/** One lazy connection belongs to one read operation, including its abort path. */
export function createConnectionScope(
  options,
  signal,
  connect = mysql.createConnection,
) {
  let opening,
    closing,
    connection,
    socket,
    closed = false;
  // mysql2.destroy() currently ends the stream gracefully. Owning the socket
  // releases transport while a read is pending. Supplying an error also settles
  // the driver's pending command; calling driver.destroy() first suppresses it.
  const abort = () => {
    closed = true;
    if (socket)
      socket.destroy(
        signal.reason instanceof Error
          ? signal.reason
          : new Error("Database read aborted."),
      );
    else connection?.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  return {
    async get() {
      signal.throwIfAborted();
      if (closed) throw new Error("Database operation is closed.");
      opening ??= connect({
        ...options,
        stream: () => {
          socket = createConnection({ host: options.host, port: options.port });
          return socket;
        },
      }).then(async (value) => {
        connection = value;
        if (closed || signal.aborted) {
          socket?.destroy();
          value.destroy();
          signal.throwIfAborted();
          throw new Error("Database operation is closed.");
        }
        // A consistent read view spans all fields in this one GraphQL operation.
        await value.query("SET TRANSACTION READ ONLY");
        await value.beginTransaction();
        return value;
      });
      return opening;
    },
    close() {
      closing ??= (async () => {
        closed = true;
        try {
          if (!opening) return;
          const value = await opening;
          if (!signal.aborted) await value.rollback();
        } catch {
          /* The API owns the diagnostic; disposal still releases the socket. */
        } finally {
          try {
            if (connection && !signal.aborted) await connection.end();
          } catch {
            /* The owned transport below also covers a failed graceful end. */
          } finally {
            socket?.destroy();
            if (!socket) connection?.destroy();
            signal.removeEventListener("abort", abort);
          }
        }
      })();
      return closing;
    },
  };
}
