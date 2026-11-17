import { parseWell, parseWellResult } from "../../shared/plate-records.mjs";
import {
  CATALOG_LIMITS,
  SCHEMA_SIGNATURE,
  SCHEMA_VERSION,
  catalogError,
} from "./catalog-schema.mjs";

function metadata(value) {
  const record = typeof value === "string" ? JSON.parse(value) : value;
  if (!record || typeof record !== "object" || Array.isArray(record))
    throw catalogError("Stored display metadata is invalid.");
  return record;
}
function bounded(rows, maximum) {
  if (rows.length > maximum)
    throw catalogError("Stored collection exceeds the showcase bounds.");
  return rows;
}
function id(value, maximum = 160) {
  if (typeof value !== "string" || !value.length || value.length > maximum)
    throw catalogError("A valid record identity is required.");
  return value;
}

/** The request owner lends this connection and owns its end/abort lifetime. */
export async function createMySqlRepository(connection) {
  let versions;
  try {
    [versions] = await connection.execute(
      "SELECT schema_version, schema_signature FROM showcase_catalog WHERE singleton = 1",
    );
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE")
      throw catalogError(
        "Stored catalog has not been initialized.",
        "CATALOG_NOT_INITIALIZED",
      );
    throw error;
  }
  if (versions.length !== 1 || versions[0].schema_version === 0)
    throw catalogError(
      "Stored catalog initialization is incomplete.",
      "CATALOG_NOT_INITIALIZED",
    );
  if (
    versions[0].schema_version !== SCHEMA_VERSION ||
    versions[0].schema_signature !== SCHEMA_SIGNATURE
  ) {
    throw catalogError(
      "Stored catalog schema does not match this application.",
      "CATALOG_SCHEMA_MISMATCH",
    );
  }

  const resultCache = new Map();

  async function readWells(sql, values) {
    const [rows] = await connection.execute(sql, values);
    return bounded(rows, CATALOG_LIMITS.wells).map((row) => ({
      ...parseWell({
        ...metadata(row.metadata),
        id: row.id,
        row: row.row_index,
        col: row.column_index,
      }),
      id: row.id,
      plateId: row.plate_id,
      asOf: row.as_of,
    }));
  }

  async function readResults(sql, values) {
    const [rows] = await connection.execute(sql, values);
    bounded(rows, CATALOG_LIMITS.history);
    if (!rows.length) return [];
    // One joined read serves every result in this history, including file aliases.
    const placeholders = rows.map(() => "?").join(",");
    const [references] = await connection.execute(
      `SELECT a.result_id, a.ordinal, a.object_key, a.reused_from_id, a.metadata AS reference_metadata, f.metadata
      FROM showcase_artifacts a JOIN showcase_files f ON f.object_key = a.object_key
      WHERE a.result_id IN (${placeholders}) ORDER BY a.result_id, a.ordinal LIMIT 401`,
      rows.map((row) => row.id),
    );
    bounded(references, CATALOG_LIMITS.history * CATALOG_LIMITS.artifacts);
    const artifacts = new Map(rows.map((row) => [row.id, []]));
    for (const reference of references) {
      const list = artifacts.get(reference.result_id);
      if (!list || list.length >= CATALOG_LIMITS.artifacts)
        throw catalogError(
          "Stored artifact references exceed the showcase bounds.",
        );
      const file = metadata(reference.metadata);
      const ownedReference = metadata(reference.reference_metadata);
      list.push({
        key: reference.object_key,
        kind: file.kind,
        ruleId: file.ruleId,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        legalHold: ownedReference.legalHold,
        restore: ownedReference.restore,
        reusedFrom: reference.reused_from_id ?? undefined,
      });
    }
    const results = rows.map((row) => ({
      ...parseWellResult({
        ...metadata(row.metadata),
        id: row.id,
        wellId: row.well_id,
        seq: row.sequence_index,
        supersedes: row.supersedes_id ?? undefined,
        artifacts: artifacts.get(row.id),
      }),
      anchorPlateId: row.anchor_plate_id,
    }));
    // Histories seed the request-local relation cache, so aliases and supersession
    // resolvers reuse their already reconstructed result instead of querying again.
    for (const result of results)
      resultCache.set(result.id, Promise.resolve(result));
    return results;
  }

  return Object.freeze({
    mode: "stored",
    async getPlate(plateId) {
      const [rows] = await connection.execute(
        "SELECT id, as_of, rows_count, columns_count FROM showcase_plates WHERE id = ? LIMIT 1",
        [id(plateId)],
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            asOf: row.as_of,
            rows: row.rows_count,
            columns: row.columns_count,
          }
        : null;
    },
    async getWell(plateId, wellId) {
      const rows = await readWells(
        `SELECT w.*, p.as_of FROM showcase_wells w JOIN showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = ? AND w.id = ? LIMIT 1`,
        [id(plateId), id(wellId)],
      );
      return rows[0] ?? null;
    },
    listWells(plateId) {
      return readWells(
        `SELECT w.*, p.as_of FROM showcase_wells w JOIN showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = ? ORDER BY w.row_index, w.column_index LIMIT 97`,
        [id(plateId)],
      );
    },
    listHistory(plateId, wellId) {
      return readResults(
        `SELECT * FROM showcase_results WHERE anchor_plate_id = ? AND well_id = ? ORDER BY sequence_index LIMIT 51`,
        [id(plateId), id(wellId)],
      );
    },
    getResult(resultId) {
      const key = id(resultId);
      if (!resultCache.has(key))
        resultCache.set(
          key,
          readResults("SELECT * FROM showcase_results WHERE id = ? LIMIT 1", [
            key,
          ]).then((results) => results[0] ?? null),
        );
      return resultCache.get(key);
    },
  });
}
