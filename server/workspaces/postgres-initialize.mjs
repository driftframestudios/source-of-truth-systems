import { schemaShape } from "../postgres/schema-shape.mjs";
import {
  WORKSPACE_SCHEMA_SQL,
  WORKSPACE_SCHEMA_SIGNATURE,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_TABLES,
  existingPostgresWorkspaceTables,
  verifyPostgresWorkspaceTables,
  postgresWorkspaceSchemaError,
} from "./postgres-schema.mjs";

/** Explicit setup owns this whole transaction; ordinary app startup never runs DDL. */
export async function initializePostgresWorkspaces(client) {
  await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  try {
    await client.query("SET LOCAL search_path TO pg_catalog, public");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(1936684103, 2)");
    const tables = await existingPostgresWorkspaceTables(client);
    if (tables.size) {
      // PostgreSQL atomically commits this DDL and its marker. Partial or foreign
      // structures need explicit review; setup preserves every existing record.
      if (tables.size !== WORKSPACE_TABLES.length)
        throw postgresWorkspaceSchemaError();
      await verifyPostgresWorkspaceTables(client, tables);
      await client.query("COMMIT");
      return { initialized: false, version: WORKSPACE_SCHEMA_VERSION };
    }
    await client.query(WORKSPACE_SCHEMA_SQL);
    const shape = await schemaShape(client, WORKSPACE_TABLES);
    await client.query(
      `INSERT INTO public.showcase_workspace_schema
      (singleton, schema_version, schema_signature, shape_signature) VALUES (1, $1, $2, $3)`,
      [WORKSPACE_SCHEMA_VERSION, WORKSPACE_SCHEMA_SIGNATURE, shape],
    );
    await verifyPostgresWorkspaceTables(client);
    await client.query("COMMIT");
    return { initialized: true, version: WORKSPACE_SCHEMA_VERSION };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The caller owns disposal; preserve the original setup failure.
    }
    throw error;
  }
}
