export const WORKSPACE_LIMITS = Object.freeze({
  ttlMs: 24 * 60 * 60 * 1000,
  workspaces: 128,
  changedEvents: 64,
  receipts: 128,
  cleanupBatch: 16,
  history: 20,
  operationMs: 4000,
});
