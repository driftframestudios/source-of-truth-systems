/** Wire bounds shared by the Source metadata owner and workspace receivers. */
export const SOURCE_METADATA_LIMITS = Object.freeze({
  title: 180,
  description: 2000,
  tags: 12,
  tag: 40,
});
export const WORKSPACE_WIRE_LIMITS = Object.freeze({
  id: 128,
  message: 1000,
  sources: 256,
  history: 20,
  changedEvents: 64,
  revision: 2147483647,
});
export const WORKSPACE_CODES = Object.freeze([
  "OK",
  "LOCAL",
  "ABSENT",
  "EXPIRED",
  "DENIED",
  "INVALID",
  "CONFLICT",
  "QUOTA",
  "UNAVAILABLE",
  "MISSING",
]);
