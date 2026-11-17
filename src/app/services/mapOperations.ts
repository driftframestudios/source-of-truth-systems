import type { GraphNode } from "../types";
import type { CommandRefusal, CommandResult, WorkflowCheck } from "./command";
import { commandRefusal } from "./command";
import {
  orderTransitions,
  reviewTransitions,
  sampleTransitions,
} from "./recordSession";
import type { OrderEvent, ReviewEvent, SampleEvent } from "./recordSession";

export type MapCommand =
  | {
      readonly id: string;
      readonly type: "sample";
      readonly event: SampleEvent;
    }
  | { readonly id: string; readonly type: "order"; readonly event: OrderEvent }
  | {
      readonly id: string;
      readonly type: "review";
      readonly event: ReviewEvent;
    };
export interface MapAction {
  readonly label: string;
  readonly next: string;
  readonly command: MapCommand;
}
export interface MapSession {
  readonly order: ReadonlyArray<string>;
  readonly byId: Readonly<Record<string, GraphNode>>;
}
const CONTRACTS = {
  sample: { action: "sample.manage", field: "sampleState" },
  order: { action: "sample.manage", field: "orderState" },
  review: { action: "review.approve", field: "reviewState" },
} as const;
const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export function createMapSession(nodes: ReadonlyArray<GraphNode>): MapSession {
  return {
    order: nodes.map((node) => node.id),
    byId: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}

/** These nodes demonstrate workflow states; their systems remain distinct from patient records. */
export function mapActions(node: GraphNode): ReadonlyArray<MapAction> {
  return [
    ...(node.sampleState
      ? sampleTransitions(node.sampleState).map((step) => ({
          ...step,
          command: { id: node.id, type: "sample", event: step.event } as const,
        }))
      : []),
    ...(node.orderState
      ? orderTransitions(node.orderState).map((step) => ({
          ...step,
          command: { id: node.id, type: "order", event: step.event } as const,
        }))
      : []),
    ...(node.reviewState
      ? reviewTransitions(node.reviewState).map((step) => ({
          ...step,
          command: { id: node.id, type: "review", event: step.event } as const,
        }))
      : []),
  ];
}

export function createMapCommands(owner: {
  readonly getState: () => MapSession;
  readonly commit: (state: MapSession) => void;
  readonly checkPermission: WorkflowCheck;
}) {
  function prepare(
    command: MapCommand,
  ): { ok: true; next: MapSession } | CommandRefusal {
    if (
      !command ||
      typeof command.id !== "string" ||
      typeof command.event !== "string" ||
      !own(CONTRACTS, command.type)
    ) {
      return commandRefusal(
        "invalid",
        "Choose an available map workflow action.",
      );
    }
    const state = owner.getState();
    const node = own(state.byId, command.id)
      ? state.byId[command.id]
      : undefined;
    if (!node)
      return commandRefusal("missing", "This map node is no longer available.");
    const contract = CONTRACTS[command.type];
    const access = owner.checkPermission({
      action: contract.action,
      subjectId: node.id,
      dataClass: node.dataClass,
    });
    if (!access.ok) return access;
    const action = mapActions(node).find(
      (option) =>
        option.command.type === command.type &&
        option.command.event === command.event,
    );
    if (!action)
      return commandRefusal(
        "transition",
        "This workflow has moved on. Choose one of its current actions.",
      );
    const updated = { ...node, [contract.field]: action.next };
    return {
      ok: true,
      next: { ...state, byId: { ...state.byId, [node.id]: updated } },
    };
  }
  return {
    check(command: MapCommand): CommandResult {
      const result = prepare(command);
      return result.ok ? { ok: true, changed: true } : result;
    },
    execute(command: MapCommand): CommandResult {
      const result = prepare(command);
      if (!result.ok) return result;
      owner.commit(result.next);
      return { ok: true, changed: true };
    },
  };
}
