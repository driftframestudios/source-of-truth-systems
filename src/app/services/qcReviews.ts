import type { QCGate } from "../types";
import type { CommandRefusal, CommandResult, WorkflowCheck } from "./command";
import { commandRefusal, identifyRefusal } from "./command";

export type GateReview =
  "unreviewed" | "acknowledged" | "hold_recorded" | "rerun_requested";
export type GateReviewEvent =
  "acknowledge" | "retain_hold" | "request_rerun" | "reopen";
export interface GateReviewCommand {
  readonly id: string;
  readonly event: GateReviewEvent;
}
export interface QcReviewState {
  readonly byId: Readonly<Record<string, GateReview>>;
}
export const GATE_REVIEW_LABELS: Readonly<Record<GateReview, string>> = {
  unreviewed: "Awaiting review",
  acknowledged: "Acknowledged",
  hold_recorded: "Hold recorded",
  rerun_requested: "Rerun requested",
};
export const GATE_REVIEW_ACTIONS = {
  acknowledge: { label: "Acknowledge", next: "acknowledged" },
  retain_hold: { label: "Keep on hold", next: "hold_recorded" },
  request_rerun: { label: "Request rerun", next: "rerun_requested" },
  reopen: { label: "Reopen review", next: "unreviewed" },
} as const;
const CAPABILITIES = {
  wet_lab: "sample.manage",
  sequencing: "analysis.run",
  secondary: "analysis.run",
  sign_out: "release.manage",
} as const;
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export function createQcReviews(gates: ReadonlyArray<QCGate>): QcReviewState {
  return {
    byId: Object.fromEntries(
      gates.map((gate) => [gate.id, "unreviewed" as const]),
    ),
  };
}

export function gateReviewEvents(
  gate: QCGate,
  review: GateReview,
): ReadonlyArray<GateReviewEvent> {
  if (review !== "unreviewed") return ["reopen"];
  return gate.status === "fail" || gate.status === "warn"
    ? ["retain_hold", "request_rerun"]
    : ["acknowledge"];
}

/** A review records the response to observed metrics; it never changes those measurements or releases a run. */
export function createQcReviewCommands(owner: {
  readonly gates: ReadonlyArray<QCGate>;
  readonly getState: () => QcReviewState;
  readonly commit: (state: QcReviewState) => void;
  readonly checkPermission: WorkflowCheck;
}) {
  const gates = new Map(owner.gates.map((gate) => [gate.id, gate]));
  function prepare(
    command: GateReviewCommand,
  ): { ok: true; next: QcReviewState } | CommandRefusal {
    if (
      !command ||
      typeof command.id !== "string" ||
      !own(GATE_REVIEW_ACTIONS, command.event)
    ) {
      return commandRefusal(
        "invalid",
        "Choose an available gate review action.",
      );
    }
    const gate = gates.get(command.id);
    const state = owner.getState();
    if (!gate || !own(state.byId, gate.id))
      return commandRefusal(
        "missing",
        "This quality gate is no longer available.",
      );
    const access = owner.checkPermission({
      action: CAPABILITIES[gate.stage],
      subjectId: gate.id,
    });
    if (!access.ok) return identifyRefusal(access);
    if (!gateReviewEvents(gate, state.byId[gate.id]).includes(command.event)) {
      return commandRefusal(
        "transition",
        "This gate review has moved on. Reopen it to record a different response.",
      );
    }
    return {
      ok: true,
      next: {
        byId: {
          ...state.byId,
          [gate.id]: GATE_REVIEW_ACTIONS[command.event].next,
        },
      },
    };
  }
  return {
    check(command: GateReviewCommand): CommandResult {
      const result = prepare(command);
      return result.ok ? { ok: true, changed: true } : result;
    },
    execute(command: GateReviewCommand): CommandResult {
      const result = prepare(command);
      if (!result.ok) return result;
      owner.commit(result.next);
      return { ok: true, changed: true };
    },
  };
}
