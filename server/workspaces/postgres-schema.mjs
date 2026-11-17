import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { existingTables, schemaShape } from "../postgres/schema-shape.mjs";

// Version 1 is an immutable applied migration. Future changes use a new version.
export const WORKSPACE_SCHEMA_VERSION = 1;
export const WORKSPACE_SCHEMA_SQL = readFileSync(
  new URL("./postgres-schema.sql", import.meta.url),
  "utf8",
);
export const WORKSPACE_SCHEMA_SIGNATURE = createHash("sha256")
  .update(WORKSPACE_SCHEMA_SQL)
  .digest("hex");
export const WORKSPACE_TABLES = Object.freeze([
  "showcase_workspace_schema",
  "showcase_visitor_workspaces",
  "showcase_workspace_sources",
  "showcase_workspace_receipts",
]);
export const postgresWorkspaceSchemaError = () =>
  Object.assign(
    new Error(
      "Visitor workspace storage needs its explicit, matching migration.",
    ),
    { code: "WORKSPACE_SCHEMA_UNAVAILABLE" },
  );

export const existingPostgresWorkspaceTables = (client) =>
  existingTables(client, WORKSPACE_TABLES);

export async function requirePostgresWorkspaceSchema(client) {
  let rows;
  try {
    ({ rows } = await client.query(
      "SELECT singleton, schema_version, schema_signature, shape_signature FROM public.showcase_workspace_schema",
    ));
  } catch (error) {
    if (["42P01", "42703"].includes(error.code))
      throw postgresWorkspaceSchemaError();
    throw error;
  }
  if (
    rows.length !== 1 ||
    rows[0].singleton !== 1 ||
    rows[0].schema_version !== WORKSPACE_SCHEMA_VERSION ||
    rows[0].schema_signature !== WORKSPACE_SCHEMA_SIGNATURE ||
    !/^[a-f0-9]{64}$/.test(rows[0].shape_signature)
  )
    throw postgresWorkspaceSchemaError();
  return rows[0];
}

export async function verifyPostgresWorkspaceTables(
  client,
  tables = new Set(WORKSPACE_TABLES),
) {
  if (tables.size !== WORKSPACE_TABLES.length)
    throw postgresWorkspaceSchemaError();
  const marker = await requirePostgresWorkspaceSchema(client);
  if ((await schemaShape(client, WORKSPACE_TABLES)) !== marker.shape_signature)
    throw postgresWorkspaceSchemaError();
}
