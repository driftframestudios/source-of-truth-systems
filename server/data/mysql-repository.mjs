// @ts-check
import { catalogId as id, CATALOG_PROBES } from "./catalog-contract.mjs";
import { decodeWells, createResultReader } from "./catalog-rows.mjs";
import {
  SCHEMA_SIGNATURE,
  SCHEMA_VERSION,
  catalogError,
} from "./catalog-schema.mjs";

/** The request owner lends this connection and owns its end/abort lifetime.
 * @param {any} connection Driver-specific connection, retained by the request owner.
 * @returns {Promise<import('./catalog-contract.mjs').CatalogRepository>}
 */
export async function createMySqlRepository(connection) {
  let versions;
  try {
    [versions] = await connection.execute(
      "SELECT schema_version, schema_signature FROM showcase_catalog WHERE singleton = 1",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ER_NO_SUCH_TABLE"
    )
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

  const results = createResultReader(async (ids) => {
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT a.result_id, a.ordinal, a.object_key, a.reused_from_id, a.metadata AS reference_metadata, f.metadata
        FROM showcase_artifacts a JOIN showcase_files f ON f.object_key = a.object_key
        WHERE a.result_id IN (${placeholders}) ORDER BY a.result_id, a.ordinal LIMIT ${CATALOG_PROBES.references}`,
      ids,
    );
    return rows;
  });
  /** @param {string} sql @param {string[]} values */
  async function readWells(sql, values) {
    const [rows] = await connection.execute(sql, values);
    return decodeWells(rows);
  }
  /** @param {string} sql @param {string[]} values */
  async function readResults(sql, values) {
    const [rows] = await connection.execute(sql, values);
    return results.decode(rows);
  }

  return Object.freeze({
    mode: "stored",
    /** @param {string} plateId */
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
    /** @param {string} plateId @param {string} wellId */
    async getWell(plateId, wellId) {
      const rows = await readWells(
        `SELECT w.*, p.as_of FROM showcase_wells w JOIN showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = ? AND w.id = ? LIMIT 1`,
        [id(plateId), id(wellId)],
      );
      return rows[0] ?? null;
    },
    /** @param {string} plateId */
    listWells(plateId) {
      return readWells(
        `SELECT w.*, p.as_of FROM showcase_wells w JOIN showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = ? ORDER BY w.row_index, w.column_index LIMIT ${CATALOG_PROBES.wells}`,
        [id(plateId)],
      );
    },
    /** @param {string} plateId @param {string} wellId */
    listHistory(plateId, wellId) {
      return readResults(
        `SELECT * FROM showcase_results WHERE anchor_plate_id = ? AND well_id = ? ORDER BY sequence_index LIMIT ${CATALOG_PROBES.history}`,
        [id(plateId), id(wellId)],
      );
    },
    /** @param {string} resultId */
    getResult(resultId) {
      const key = id(resultId);
      return results.get(key, () =>
        readResults("SELECT * FROM showcase_results WHERE id = ? LIMIT 1", [
          key,
        ]),
      );
    },
  });
}
