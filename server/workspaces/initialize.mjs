import { createHash } from "node:crypto";
import {
  WORKSPACE_SCHEMA_SIGNATURE,
  WORKSPACE_SCHEMA_STATEMENTS,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_TABLES,
  workspaceSchemaError,
  existingWorkspaceTables,
  verifyWorkspaceTables,
} from "./schema.mjs";

/** A separately owned additive migration; the installed Plate catalog stays untouched. */
export async function initializeWorkspaces(connection) {
  const [[database]] = await connection.execute("SELECT DATABASE() AS name");
  if (!database.name) throw workspaceSchemaError();
  const lockName = `sot-workspaces:${createHash("sha256").update(database.name).digest("hex").slice(0, 32)}`;
  const [[lock]] = await connection.execute(
    "SELECT GET_LOCK(?, 5) AS acquired",
    [lockName],
  );
  if (lock.acquired !== 1) throw workspaceSchemaError();
  try {
    const tables = await existingWorkspaceTables(connection);
    if (tables.size && !tables.has(WORKSPACE_TABLES[0]))
      throw workspaceSchemaError();
    await verifyWorkspaceTables(connection, tables);
    let marker;
    if (tables.has(WORKSPACE_TABLES[0])) {
      const [rows] = await connection.execute(
        "SELECT schema_version, schema_signature FROM showcase_workspace_schema WHERE singleton = 1",
      );
      marker = rows[0];
      if (
        rows.length !== 1 ||
        marker.schema_signature !== WORKSPACE_SCHEMA_SIGNATURE ||
        ![0, WORKSPACE_SCHEMA_VERSION].includes(marker.schema_version)
      )
        throw workspaceSchemaError();
      if (marker.schema_version === WORKSPACE_SCHEMA_VERSION) {
        if (tables.size !== WORKSPACE_TABLES.length)
          throw workspaceSchemaError();
        return { initialized: false, version: WORKSPACE_SCHEMA_VERSION };
      }
      // Known interrupted DDL is resumable only before any visitor state exists.
      for (const table of WORKSPACE_TABLES.slice(1).filter((table) =>
        tables.has(table),
      )) {
        const [rows] = await connection.query(`SELECT 1 FROM ${table} LIMIT 1`);
        if (rows.length) throw workspaceSchemaError();
      }
    } else {
      await connection.query(WORKSPACE_SCHEMA_STATEMENTS[0]);
      await connection.execute(
        "INSERT INTO showcase_workspace_schema (singleton, schema_version, schema_signature) VALUES (1, 0, ?)",
        [WORKSPACE_SCHEMA_SIGNATURE],
      );
    }
    for (let index = 1; index < WORKSPACE_TABLES.length; index++) {
      if (!tables.has(WORKSPACE_TABLES[index]))
        await connection.query(WORKSPACE_SCHEMA_STATEMENTS[index]);
    }
    await verifyWorkspaceTables(connection);
    await connection.execute(
      "UPDATE showcase_workspace_schema SET schema_version = ? WHERE singleton = 1 AND schema_version = 0 AND schema_signature = ?",
      [WORKSPACE_SCHEMA_VERSION, WORKSPACE_SCHEMA_SIGNATURE],
    );
    return { initialized: true, version: WORKSPACE_SCHEMA_VERSION };
  } finally {
    await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
  }
}
