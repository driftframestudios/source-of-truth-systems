import {
  SOURCE_METADATA_LIMITS as META,
  WORKSPACE_WIRE_LIMITS as LIMIT,
  WORKSPACE_CODES,
} from "../../../shared/workspace-contract.mjs";
import type {
  WorkspaceCode,
  WorkspaceOperation,
  WorkspaceResponse,
  VisitorWorkspace,
  WorkspaceSource,
  WorkspaceEvent,
} from "./workspaceTransport";

const FIELDS = {
  WorkspaceStatus: "workspaceStatus",
  StartWorkspace: "startWorkspace",
  ResetWorkspace: "resetWorkspace",
  WorkspaceSnapshot: "workspaceSnapshot",
  WorkspaceSource: "workspaceSource",
  WorkspaceHistory: "workspaceHistory",
  SaveSource: "saveSource",
  RestoreSource: "restoreSource",
} satisfies Record<WorkspaceOperation, string>;
type Payloads = {
  WorkspaceStatus: { available: boolean };
  StartWorkspace: { available: boolean };
  ResetWorkspace: { available: boolean };
  WorkspaceSnapshot: { sources: ReadonlyArray<WorkspaceSource> };
  WorkspaceSource: { source: WorkspaceSource };
  WorkspaceHistory: { events: ReadonlyArray<WorkspaceEvent> };
  SaveSource: { source: WorkspaceSource; changed: boolean; replayed: boolean };
  RestoreSource: {
    source: WorkspaceSource;
    changed: boolean;
    replayed: boolean;
  };
};
export type WorkspaceOutcome<
  O extends WorkspaceOperation = WorkspaceOperation,
> =
  | (WorkspaceResponse & {
      code: "OK";
      workspace: VisitorWorkspace;
    } & Payloads[O])
  | (WorkspaceResponse & { code: Exclude<WorkspaceCode, "OK"> });
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.length <= max &&
  !/[\u0000\uD800-\uDFFF]/u.test(v);
const integer = (v: unknown, max: number = LIMIT.revision): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
function workspace(v: unknown): VisitorWorkspace | null | undefined {
  if (v === null) return null;
  if (
    !object(v) ||
    !text(v.id, LIMIT.id) ||
    !timestamp(v.createdAt) ||
    !timestamp(v.expiresAt) ||
    Date.parse(v.expiresAt) <= Date.parse(v.createdAt) ||
    !integer(v.eventCount, LIMIT.changedEvents)
  )
    return;
  return {
    id: v.id,
    createdAt: v.createdAt,
    expiresAt: v.expiresAt,
    eventCount: v.eventCount,
  };
}
function source(v: unknown): WorkspaceSource | undefined {
  if (
    !object(v) ||
    !text(v.id, LIMIT.id) ||
    !integer(v.revision) ||
    !text(v.title, META.title) ||
    !text(v.description, META.description) ||
    !Array.isArray(v.tags) ||
    v.tags.length > META.tags ||
    !v.tags.every((t) => text(t, META.tag))
  )
    return;
  return {
    id: v.id,
    revision: v.revision,
    title: v.title,
    description: v.description,
    tags: [...v.tags],
  };
}
function event(v: unknown): WorkspaceEvent | undefined {
  if (
    !object(v) ||
    !text(v.id, LIMIT.id) ||
    !text(v.sourceId, LIMIT.id) ||
    (v.action !== "save" && v.action !== "restore") ||
    !timestamp(v.createdAt) ||
    !integer(v.expectedRevision) ||
    !integer(v.resultRevision) ||
    v.resultRevision !== v.expectedRevision + 1 ||
    !object(v.actor) ||
    !text(v.actor.principalId, LIMIT.id) ||
    !text(v.actor.roleId, LIMIT.id) ||
    !text(v.actor.environment, LIMIT.id)
  )
    return;
  return {
    id: v.id,
    sourceId: v.sourceId,
    action: v.action,
    createdAt: v.createdAt,
    expectedRevision: v.expectedRevision,
    resultRevision: v.resultRevision,
    actor: {
      principalId: v.actor.principalId,
      roleId: v.actor.roleId,
      environment: v.actor.environment,
    },
  };
}
function collection<T extends { id: string }>(
  v: unknown,
  max: number,
  decode: (input: unknown) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(v) || v.length > max) return;
  const result: T[] = [],
    ids = new Set<string>();
  for (const input of v) {
    const item = decode(input);
    if (!item || ids.has(item.id)) return;
    ids.add(item.id);
    result.push(item);
  }
  return result;
}

/** Copy only the operation's owned fields; the domain still checks current revision and authority. */
export function decodeWorkspaceResponse<O extends WorkspaceOperation>(
  operation: O,
  body: unknown,
  variables: Record<string, unknown> = {},
): WorkspaceOutcome<O> | undefined {
  if (
    !object(body) ||
    body.errors !== undefined ||
    !object(body.data) ||
    !Object.prototype.hasOwnProperty.call(body.data, FIELDS[operation])
  )
    return;
  const v = body.data[FIELDS[operation]];
  if (
    !object(v) ||
    !WORKSPACE_CODES.includes(v.code as WorkspaceCode) ||
    !text(v.message, LIMIT.message)
  )
    return;
  const receivedWorkspace = workspace(v.workspace);
  if (
    receivedWorkspace === undefined ||
    (v.code === "OK" && !receivedWorkspace)
  )
    return;
  const base: WorkspaceResponse = {
    code: v.code as WorkspaceCode,
    message: v.message,
    workspace: receivedWorkspace,
  };
  let payload: Partial<WorkspaceResponse> & { available?: boolean };
  switch (operation) {
    case "WorkspaceStatus":
    case "StartWorkspace":
    case "ResetWorkspace":
      if (typeof v.available !== "boolean") return;
      payload = { available: v.available };
      break;
    case "WorkspaceSnapshot": {
      const sources = collection(v.sources, LIMIT.sources, source);
      if (!sources) return;
      payload = { sources };
      break;
    }
    case "WorkspaceHistory": {
      const events = collection(v.events, LIMIT.history, event);
      if (!events || events.some((e) => e.sourceId !== variables.sourceId))
        return;
      payload = { events };
      break;
    }
    case "WorkspaceSource":
    case "SaveSource":
    case "RestoreSource": {
      const received = v.source === null ? null : source(v.source);
      const id =
        operation === "WorkspaceSource"
          ? variables.id
          : object(variables.input)
            ? variables.input.id
            : undefined;
      if (
        received === undefined ||
        (v.code === "OK" && !received) ||
        (received && received.id !== id)
      )
        return;
      payload = { source: received };
      if (operation !== "WorkspaceSource") {
        if (typeof v.changed !== "boolean" || typeof v.replayed !== "boolean")
          return;
        if (
          v.code === "OK" &&
          (!object(variables.input) ||
            !integer(variables.input.expectedRevision) ||
            received?.revision !==
              variables.input.expectedRevision + Number(v.changed))
        )
          return;
        payload = { ...payload, changed: v.changed, replayed: v.replayed };
      }
      break;
    }
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
  return { ...base, ...payload } as WorkspaceOutcome<O>;
}
