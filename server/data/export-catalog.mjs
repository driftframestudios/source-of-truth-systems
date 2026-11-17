import {
  CATALOG_TABLES,
  SCHEMA_SIGNATURE,
  SCHEMA_STATEMENTS,
} from "./catalog-schema.mjs";
import {
  catalogSeedStatements,
  completionStatement,
  prepareCatalogSeed,
} from "./initialize-catalog.mjs";

// Ordinary UTF-8 text stays readable and compact. Double apostrophes work in
// both MySQL backslash modes; rare control/backslash strings retain hex encoding.
function literal(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isSafeInteger(value))
    return String(value);
  if (typeof value === "string") {
    if (/[\\\x00-\x1f\x7f]/.test(value))
      return `CONVERT(X'${Buffer.from(value, "utf8").toString("hex")}' USING utf8mb4)`;
    return `'${value.replaceAll("'", "''")}'`;
  }
  throw new TypeError("Unsupported catalog export value.");
}
function bind({ sql, values }) {
  let index = 0;
  const statement = sql.replace(/\?/g, () => literal(values[index++]));
  if (index !== values.length)
    throw new Error("Catalog export parameter mismatch.");
  return statement;
}

/** First-install import artifact. It cannot replace an accepted or partial catalog. */
export function exportCatalogSql(data) {
  const seed = prepareCatalogSeed(data);
  const statements = [
    "SET NAMES utf8mb4",
    `SET @showcase_catalog_existing_tables = (SELECT COUNT(*) FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${CATALOG_TABLES.map((table) => `'${table}'`).join(", ")}))`,
    ...SCHEMA_STATEMENTS,
    `INSERT INTO showcase_catalog (singleton, schema_version, schema_signature)
      SELECT 1, 0, '${SCHEMA_SIGNATURE}' WHERE @showcase_catalog_existing_tables = 0 AND NOT EXISTS (SELECT 1 FROM showcase_catalog WHERE singleton = 1)`,
    "START TRANSACTION",
    "SET @showcase_catalog_version = NULL",
    "SELECT schema_version INTO @showcase_catalog_version FROM showcase_catalog WHERE singleton = 1 FOR UPDATE",
    `SET @showcase_catalog_import_allowed = (@showcase_catalog_version = 0
      AND EXISTS (SELECT 1 FROM showcase_catalog WHERE singleton = 1 AND schema_signature = '${SCHEMA_SIGNATURE}')
      AND ${CATALOG_TABLES.slice(1)
        .map((table) => `(SELECT COUNT(*) FROM ${table}) = 0`)
        .join(" AND ")})`,
    ...catalogSeedStatements(seed).map(
      (statement) =>
        `${bind(statement)} WHERE @showcase_catalog_import_allowed = 1`,
    ),
    `${bind(completionStatement(seed))} AND @showcase_catalog_import_allowed = 1`,
    "COMMIT",
  ];
  return `-- Source of Truth: synthetic Plate/results catalog, first install only.\n-- Import with a client that stops on errors. DDL commits independently.\n-- An existing complete or nonempty partial catalog retains its records.\n\n${statements.join(";\n\n")};\n`;
}
