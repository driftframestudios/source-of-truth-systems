import { PLATE_LIMITS } from "../../shared/plate-records.mjs";

export const CATALOG_LIMITS = Object.freeze({
  wells: PLATE_LIMITS.wells,
  history: PLATE_LIMITS.history,
  artifacts: PLATE_LIMITS.artifacts,
});
export const CATALOG_PROBES = Object.freeze({
  wells: CATALOG_LIMITS.wells + 1,
  history: CATALOG_LIMITS.history + 1,
  references: CATALOG_LIMITS.history * CATALOG_LIMITS.artifacts + 1,
});

export function catalogError(message, code = "CATALOG_INVALID") {
  return Object.assign(new Error(message), { code });
}
export function catalogId(value, maximum = 160) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > maximum ||
    value.includes("\u0000") ||
    !value.isWellFormed()
  )
    throw catalogError("A valid record identity is required.");
  return value;
}
export function bounded(rows, maximum) {
  if (rows.length > maximum)
    throw catalogError("Stored collection exceeds the showcase bounds.");
  return rows;
}
