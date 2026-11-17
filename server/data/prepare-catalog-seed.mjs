import { assertPlateCatalog } from "../../shared/plate-records.mjs";

const omit = (value, keys) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );

/** Normalize the accepted seed once, retaining physical and reference ownership. */
export function prepareCatalogSeed(data) {
  const catalog = assertPlateCatalog(data);
  const results = [...catalog.results].sort((a, b) => a.seq - b.seq);
  const byId = new Map(results.map((result) => [result.id, result]));
  const files = new Map();
  const artifacts = [];
  for (const result of results) {
    result.artifacts.forEach((artifact, ordinal) => {
      if (!files.has(artifact.key))
        files.set(
          artifact.key,
          omit(artifact, ["key", "reusedFrom", "legalHold", "restore"]),
        );
      artifacts.push({
        resultId: result.id,
        ordinal,
        key: artifact.key,
        wellId: result.wellId,
        sequence: result.seq,
        reusedFrom: artifact.reusedFrom ?? null,
        reusedSequence: artifact.reusedFrom
          ? byId.get(artifact.reusedFrom).seq
          : null,
        metadata: Object.fromEntries(
          ["legalHold", "restore"]
            .filter((key) => artifact[key] != null)
            .map((key) => [key, artifact[key]]),
        ),
      });
    });
  }
  return {
    plateId: catalog.plateId,
    asOf: catalog.asOf,
    wells: catalog.wells.map((well) => ({
      id: `${"ABCDEFGH"[well.row]}${well.col + 1}`,
      row: well.row,
      col: well.col,
      metadata: omit(well, ["id", "row", "col"]),
    })),
    results: results.map((result) => ({
      id: result.id,
      wellId: result.wellId,
      sequence: result.seq,
      supersedes: result.supersedes ?? null,
      supersedesSequence: result.supersedes
        ? byId.get(result.supersedes).seq
        : null,
      metadata: omit(result, [
        "id",
        "wellId",
        "seq",
        "supersedes",
        "artifacts",
      ]),
    })),
    files: [...files].map(([key, metadata]) => ({ key, metadata })),
    artifacts,
  };
}
