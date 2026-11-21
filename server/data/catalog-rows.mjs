// @ts-check
import { parseWell, parseWellResult } from "../../shared/plate-records.mjs";
import { CATALOG_LIMITS, bounded, catalogError } from "./catalog-contract.mjs";

/** @param {unknown} value @returns {Record<string, unknown>} */
function metadata(value) {
  let record;
  try {
    record = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    throw catalogError("Stored display metadata is invalid.");
  }
  if (!record || typeof record !== "object" || Array.isArray(record))
    throw catalogError("Stored display metadata is invalid.");
  return /** @type {Record<string, unknown>} */ (record);
}

/**
 * Driver row shapes are owned by the adapter's SELECT list and SQL schema.
 * @typedef {{id:string, metadata:unknown, row_index:number, column_index:number, plate_id:string, as_of:string}} WellRow
 * @typedef {{id:string, metadata:unknown, well_id:string, sequence_index:number, supersedes_id:string|null, anchor_plate_id:string}} ResultRow
 * @typedef {{result_id:string, object_key:string, reused_from_id:string|null, metadata:unknown, reference_metadata:unknown}} ReferenceRow
 */
/** @param {WellRow[]} rows */
export function decodeWells(rows) {
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
/** @param {ResultRow[]} rows @param {ReferenceRow[]} references */
export function decodeResults(rows, references) {
  bounded(rows, CATALOG_LIMITS.history);
  bounded(references, CATALOG_LIMITS.history * CATALOG_LIMITS.artifacts);
  /** @type {Map<string, Record<string, unknown>[]>} */
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
  return results;
}

/**
 * The adapter supplies its joined artifact read; this owner retains one request's results.
 * @param {(ids:string[]) => Promise<ReferenceRow[]>} readReferences
 */
export function createResultReader(readReferences) {
  /** @type {Map<string, Promise<import('./catalog-contract.mjs').CatalogResult|null>>} */
  const cache = new Map();
  return {
    /** @param {ResultRow[]} rows */
    async decode(rows) {
      bounded(rows, CATALOG_LIMITS.history);
      if (!rows.length) return [];
      const results = decodeResults(
        rows,
        await readReferences(rows.map((row) => row.id)),
      );
      for (const result of results)
        cache.set(result.id, Promise.resolve(result));
      return results;
    },
    /** @param {string} key @param {() => Promise<import('./catalog-contract.mjs').CatalogResult[]>} read */
    get(key, read) {
      let result = cache.get(key);
      if (!result) {
        result = read().then((rows) => rows[0] ?? null);
        cache.set(key, result);
      }
      return result;
    },
  };
}
