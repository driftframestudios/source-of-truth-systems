// @ts-check
import { catalogId as id, CATALOG_PROBES } from "./catalog-contract.mjs";
import { decodeWells, createResultReader } from "./catalog-rows.mjs";
import { requirePostgresCatalog } from "./postgres-catalog-schema.mjs";

/** The request owner lends this connection and owns its end/abort lifetime.
 * @param {any} connection Driver-specific connection, retained by the request owner.
 * @returns {Promise<import('./catalog-contract.mjs').CatalogRepository>}
 */
export async function createPostgresRepository(connection) {
  await requirePostgresCatalog(connection);

  const results = createResultReader(async (ids) => {
    const { rows } = await connection.query(
      `SELECT a.result_id, a.ordinal, a.object_key, a.reused_from_id, a.metadata AS reference_metadata, f.metadata
        FROM public.showcase_artifacts a JOIN public.showcase_files f ON f.object_key = a.object_key
        WHERE a.result_id = ANY($1::varchar[]) ORDER BY a.result_id, a.ordinal LIMIT ${CATALOG_PROBES.references}`,
      [ids],
    );
    return rows;
  });
  /** @param {string} sql @param {string[]} values */
  async function readWells(sql, values) {
    const { rows } = await connection.query(sql, values);
    return decodeWells(rows);
  }
  /** @param {string} sql @param {string[]} values */
  async function readResults(sql, values) {
    const { rows } = await connection.query(sql, values);
    return results.decode(rows);
  }

  return Object.freeze({
    mode: "stored",
    /** @param {string} plateId */
    async getPlate(plateId) {
      const { rows } = await connection.query(
        "SELECT id, as_of, rows_count, columns_count FROM public.showcase_plates WHERE id = $1 LIMIT 1",
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
        `SELECT w.*, p.as_of FROM public.showcase_wells w JOIN public.showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = $1 AND w.id = $2 LIMIT 1`,
        [id(plateId), id(wellId)],
      );
      return rows[0] ?? null;
    },
    /** @param {string} plateId */
    listWells(plateId) {
      return readWells(
        `SELECT w.*, p.as_of FROM public.showcase_wells w JOIN public.showcase_plates p ON p.id = w.plate_id
        WHERE w.plate_id = $1 ORDER BY w.row_index, w.column_index LIMIT ${CATALOG_PROBES.wells}`,
        [id(plateId)],
      );
    },
    /** @param {string} plateId @param {string} wellId */
    listHistory(plateId, wellId) {
      return readResults(
        `SELECT * FROM public.showcase_results WHERE anchor_plate_id = $1 AND well_id = $2 ORDER BY sequence_index LIMIT ${CATALOG_PROBES.history}`,
        [id(plateId), id(wellId)],
      );
    },
    /** @param {string} resultId */
    getResult(resultId) {
      const key = id(resultId);
      return results.get(key, () =>
        readResults(
          "SELECT * FROM public.showcase_results WHERE id = $1 LIMIT 1",
          [key],
        ),
      );
    },
  });
}
