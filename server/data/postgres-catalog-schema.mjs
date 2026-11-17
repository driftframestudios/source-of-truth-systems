import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { catalogError } from "./catalog-schema.mjs";

export const POSTGRES_CATALOG_VERSION = 1;
export const POSTGRES_CATALOG_SEED_VERSION = 1;
const sql = readFileSync(
  new URL("./postgres-schema.sql", import.meta.url),
  "utf8",
);
export const POSTGRES_CATALOG_SIGNATURE = createHash("sha256")
  .update(sql)
  .digest("hex");
export const POSTGRES_CATALOG_STATEMENTS = Object.freeze(
  sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean),
);

export async function requirePostgresCatalog(client) {
  let rows;
  try {
    ({ rows } = await client.query(
      "SELECT schema_version, schema_signature, shape_signature, seed_version, seed_signature FROM public.showcase_catalog WHERE singleton = 1",
    ));
  } catch (error) {
    if (error.code === "42P01")
      throw catalogError(
        "Stored catalog has not been initialized.",
        "CATALOG_NOT_INITIALIZED",
      );
    if (error.code === "42703")
      throw catalogError(
        "Stored catalog marker requires explicit schema review.",
        "CATALOG_SCHEMA_MISMATCH",
      );
    throw error;
  }
  const marker = rows[0];
  if (!marker || rows.length !== 1)
    throw catalogError(
      "Stored catalog initialization is incomplete.",
      "CATALOG_NOT_INITIALIZED",
    );
  if (
    marker.schema_version !== POSTGRES_CATALOG_VERSION ||
    marker.schema_signature !== POSTGRES_CATALOG_SIGNATURE ||
    marker.seed_version !== POSTGRES_CATALOG_SEED_VERSION ||
    !/^[0-9a-f]{64}$/.test(marker.seed_signature) ||
    !/^[0-9a-f]{64}$/.test(marker.shape_signature)
  )
    throw catalogError(
      "Stored catalog schema does not match this application.",
      "CATALOG_SCHEMA_MISMATCH",
    );
  return marker;
}
