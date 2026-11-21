import { WORKSPACE_WIRE_LIMITS } from '../../shared/workspace-contract.mjs';
export const WORKSPACE_LIMITS = Object.freeze({
  ttlMs: 24 * 60 * 60 * 1000,
  workspaces: 128,
  changedEvents: WORKSPACE_WIRE_LIMITS.changedEvents,
  receipts: 128,
  cleanupBatch: 16,
  history: WORKSPACE_WIRE_LIMITS.history,
  operationMs: 4000,
});
