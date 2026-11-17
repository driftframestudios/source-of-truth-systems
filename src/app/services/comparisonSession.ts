import type { Comparison, ResolutionStatus } from "../types";

export type ComparisonEvent = "resolve" | "defer" | "reopen";

const TRANSITIONS: Record<
  ResolutionStatus,
  Partial<Record<ComparisonEvent, ResolutionStatus>>
> = {
  pending: { resolve: "resolved", defer: "deferred" },
  conflict: { resolve: "resolved", defer: "deferred" },
  deferred: { resolve: "resolved", reopen: "pending" },
  resolved: { reopen: "pending" },
};

export const COMPARISON_ACTIONS: Record<
  ComparisonEvent,
  { label: string; description: string }
> = {
  resolve: {
    label: "Resolve",
    description: "Accept the resolution shown for this comparison.",
  },
  defer: {
    label: "Defer",
    description: "Keep this comparison for a later review.",
  },
  reopen: {
    label: "Reopen",
    description: "Return this comparison to pending review.",
  },
};

export function comparisonEvents(
  status: ResolutionStatus,
): ReadonlyArray<ComparisonEvent> {
  return Object.keys(TRANSITIONS[status]) as ComparisonEvent[];
}

export interface ComparisonSession {
  readonly order: ReadonlyArray<string>;
  readonly byId: Readonly<Record<string, Comparison>>;
}

export function createComparisonSession(
  records: ReadonlyArray<Comparison>,
): ComparisonSession {
  return {
    order: records.map((record) => record.id),
    byId: Object.fromEntries(records.map((record) => [record.id, record])),
  };
}

export function applyComparisonDecision(
  state: ComparisonSession,
  command: { readonly id: string; readonly event: ComparisonEvent },
  permission: { readonly ok: boolean },
): ComparisonSession {
  if (!permission.ok) return state;
  if (!Object.prototype.hasOwnProperty.call(state.byId, command.id)) return state;
  const record = state.byId[command.id];
  const transitions = TRANSITIONS[record.resolutionStatus];
  if (!Object.prototype.hasOwnProperty.call(transitions, command.event)) return state;
  const next = transitions[command.event];
  if (!next) return state;
  return {
    ...state,
    byId: { ...state.byId, [record.id]: { ...record, resolutionStatus: next } },
  };
}

export function selectComparisons(
  state: ComparisonSession,
): ReadonlyArray<Comparison> {
  return state.order.map((id) => state.byId[id]);
}

export function summarizeComparisons(
  records: ReadonlyArray<Comparison>,
): Record<ResolutionStatus, number> {
  const summary = { resolved: 0, pending: 0, deferred: 0, conflict: 0 };
  for (const record of records) summary[record.resolutionStatus] += 1;
  return summary;
}
