import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const SCHEMA_VERSION = 1;
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
export const SCHEMA_SIGNATURE = createHash("sha256")
  .update(schema)
  .digest("hex");
export const SCHEMA_STATEMENTS = Object.freeze(
  schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean),
);
export const CATALOG_TABLES = Object.freeze([
  "showcase_catalog",
  "showcase_plates",
  "showcase_wells",
  "showcase_results",
  "showcase_files",
  "showcase_artifacts",
]);
export { CATALOG_LIMITS, catalogError } from './catalog-contract.mjs';
