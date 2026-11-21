// @ts-check
import { catalogId, CATALOG_LIMITS, bounded } from "./catalog-contract.mjs";
import { assertPlateCatalog } from "../../shared/plate-records.mjs";
/** The same read contract keeps local example mode useful without a database.
 * @param {unknown} input
 * @returns {import('./catalog-contract.mjs').CatalogRepository}
 */
export function createExampleRepository(input) {
  const data = assertPlateCatalog(input);
  const plate = { id: data.plateId, asOf: data.asOf, rows: 8, columns: 12 };
  const wells = [...data.wells]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((well) => ({
      ...well,
      id: well.id ?? String.fromCharCode(65 + well.row) + String(well.col + 1),
      plateId: plate.id,
      asOf: plate.asOf,
    }));
  const byWell = new Map(wells.map((well) => [well.id, well]));
  const results = data.results.map((result) => ({
    ...result,
    anchorPlateId: data.plateId,
  }));
  const byResult = new Map(results.map((result) => [result.id, result]));
  /** @type {Map<string, import('./catalog-contract.mjs').CatalogResult[]>} */
  const histories = new Map(wells.map((well) => [well.id, []]));
  for (const result of results) histories.get(result.wellId)?.push(result);
  for (const list of histories.values())
    bounded(list, CATALOG_LIMITS.history).sort((a, b) => a.seq - b.seq);
  return {
    mode: "example",
    getPlate: (id) => (catalogId(id) === plate.id ? plate : null),
    getWell: (plateId, id) => {
      catalogId(plateId);
      catalogId(id);
      return plateId === plate.id ? (byWell.get(id) ?? null) : null;
    },
    listWells: (plateId) => (catalogId(plateId) === plate.id ? wells : []),
    listHistory: (plateId, wellId) => {
      catalogId(plateId);
      catalogId(wellId);
      return plateId === plate.id ? (histories.get(wellId) ?? []) : [];
    },
    getResult: (id) => byResult.get(catalogId(id)) ?? null,
  };
}
