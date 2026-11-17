import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
export const WORKSPACE_SCHEMA_VERSION = 1;
export const WORKSPACE_SCHEMA_SIGNATURE = createHash("sha256")
  .update(sql)
  .digest("hex");
export const WORKSPACE_SCHEMA_STATEMENTS = Object.freeze(
  sql
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean),
);
export const WORKSPACE_TABLES = Object.freeze([
  "showcase_workspace_schema",
  "showcase_visitor_workspaces",
  "showcase_workspace_sources",
  "showcase_workspace_receipts",
]);

// Derive the bounded structural contract from the owned DDL, rather than
// maintaining a second list of column types. MySQL exposes these normalized types.
const columns = WORKSPACE_SCHEMA_STATEMENTS.map((statement) =>
  [
    ...statement.matchAll(
      /^  (\w+) (TINYINT UNSIGNED|SMALLINT UNSIGNED|BIGINT UNSIGNED|CHAR\(\d+\)|VARCHAR\(\d+\)|JSON)(.*)$/gm,
    ),
  ].map(([, name, type, rest]) => ({
    name,
    type: type.toLowerCase(),
    collation: rest.match(/COLLATE (\w+)/)?.[1] ?? null,
  })),
);

export async function existingWorkspaceTables(connection) {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${WORKSPACE_TABLES.map(() => "?").join(",")})`,
    WORKSPACE_TABLES,
  );
  return new Set(rows.map((row) => row.name));
}

export async function verifyWorkspaceTables(
  connection,
  tables = new Set(WORKSPACE_TABLES),
) {
  for (const table of tables) {
    const index = WORKSPACE_TABLES.indexOf(table);
    const [actual] = await connection.execute(
      "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, COLLATION_NAME AS collation, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
      [table],
    );
    const expected = columns[index];
    if (
      actual.length !== expected.length ||
      actual.some(
        (column, offset) =>
          column.name !== expected[offset].name ||
          column.type !== expected[offset].type ||
          column.collation !== expected[offset].collation ||
          column.nullable !== "NO",
      )
    )
      throw workspaceSchemaError();
    const [[engine]] = await connection.execute(
      "SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [table],
    );
    if (engine?.engine !== "InnoDB") throw workspaceSchemaError();
    const [primary] = await connection.execute(
      "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
      [table],
    );
    const primaryNames = [
      ["singleton"],
      ["id"],
      ["workspace_id", "source_id"],
      ["workspace_id", "idempotency_key"],
    ][index];
    if (
      primary.length !== primaryNames.length ||
      primary.some((column, offset) => column.name !== primaryNames[offset])
    )
      throw workspaceSchemaError();
  }
  if (tables.has("showcase_visitor_workspaces")) {
    const [indexes] = await connection.execute(
      "SELECT COLUMN_NAME AS name, NON_UNIQUE AS non_unique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'showcase_visitor_workspaces' AND INDEX_NAME = 'workspace_token'",
    );
    if (
      indexes.length !== 1 ||
      indexes[0].name !== "token_hash" ||
      indexes[0].non_unique !== 0
    )
      throw workspaceSchemaError();
  }
  for (const [table, constraint] of [
    ["showcase_workspace_sources", "workspace_source_owner"],
    ["showcase_workspace_receipts", "workspace_receipt_owner"],
  ]) {
    if (!tables.has(table)) continue;
    const [keys] = await connection.execute(
      "SELECT DELETE_RULE AS rule, REFERENCED_TABLE_NAME AS target FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
      [table, constraint],
    );
    if (
      keys.length !== 1 ||
      keys[0].rule !== "CASCADE" ||
      keys[0].target !== "showcase_visitor_workspaces"
    )
      throw workspaceSchemaError();
  }
}
export const workspaceSchemaError = () =>
  Object.assign(
    new Error(
      "Visitor workspace storage needs its explicit, matching migration.",
    ),
    { code: "WORKSPACE_SCHEMA_UNAVAILABLE" },
  );

export async function requireWorkspaceSchema(connection) {
  const [rows] = await connection.execute(
    "SELECT schema_version, schema_signature FROM showcase_workspace_schema WHERE singleton = 1",
  );
  if (
    rows.length !== 1 ||
    rows[0].schema_version !== WORKSPACE_SCHEMA_VERSION ||
    rows[0].schema_signature !== WORKSPACE_SCHEMA_SIGNATURE
  )
    throw workspaceSchemaError();
}
