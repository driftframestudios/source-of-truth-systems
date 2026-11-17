/** The same read contract keeps local example mode useful without a database. */
export function createExampleRepository(data) {
  const plate = { id: data.plateId, asOf: data.asOf, rows: 8, columns: 12 };
  const wells = [...data.wells]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((well) => ({ ...well, plateId: plate.id, asOf: plate.asOf }));
  const byWell = new Map(wells.map((well) => [well.id, well]));
  const results = data.results.map((result) => ({
    ...result,
    anchorPlateId: data.plateId,
  }));
  const byResult = new Map(results.map((result) => [result.id, result]));
  const histories = new Map(wells.map((well) => [well.id, []]));
  for (const result of results) histories.get(result.wellId)?.push(result);
  for (const list of histories.values()) list.sort((a, b) => a.seq - b.seq);
  return {
    mode: "example",
    getPlate: (id) => (id === plate.id ? plate : null),
    getWell: (plateId, id) =>
      plateId === plate.id ? (byWell.get(id) ?? null) : null,
    listWells: (plateId) => (plateId === plate.id ? wells : []),
    listHistory: (plateId, wellId) =>
      plateId === plate.id ? (histories.get(wellId) ?? []) : [],
    getResult: (id) => byResult.get(id) ?? null,
  };
}
