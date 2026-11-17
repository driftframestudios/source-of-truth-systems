import type { Source } from "../types";
import type { ScenarioInput } from "../../../shared/permission-scope.mjs";
import type { CommandResult } from "./command";
import { createSessionState } from "./browserSession";
import {
  createSourceSession,
  prepareSourceCommand,
  type SourceCommand,
} from "./sourceSession";
import {
  requestWorkspace,
  type WorkspaceRequest,
  type WorkspaceResponse,
  type VisitorWorkspace,
  type WorkspaceSource,
} from "./workspaceTransport";

export interface SourceWorkspaceStatus {
  readonly phase:
    | "checking"
    | "local"
    | "absent"
    | "active"
    | "expired"
    | "unavailable"
    | "denied";
  readonly workspace: VisitorWorkspace | null;
  readonly message: string;
  readonly busy: boolean;
  readonly generation: number;
}
interface CommandContext {
  readonly scenario: ScenarioInput;
  readonly checkPermission: Parameters<
    typeof prepareSourceCommand
  >[0]["checkPermission"];
  readonly isCurrent: () => boolean;
}
const failure = (reason: string): CommandResult => ({
  ok: false,
  kind: "unavailable",
  reason,
});
const normalize = (command: SourceCommand) =>
  command.type === "restore"
    ? command
    : {
        ...command,
        metadata: {
          title: command.metadata.title.trim(),
          description: command.metadata.description.trim(),
          tags: [...new Set(command.metadata.tags.map((tag) => tag.trim()))],
        },
      };

/** The source projection and its remote workspace share the app-instance lifetime. */
export function createSourceWorkspace({
  baseline,
  request = requestWorkspace,
  newId = () => crypto.randomUUID(),
}: {
  readonly baseline: ReadonlyArray<Source>;
  readonly request?: WorkspaceRequest;
  readonly newId?: () => string;
}) {
  const originals = new Map(baseline.map((record) => [record.id, record]));
  const state = createSessionState(createSourceSession(baseline));
  const status = createSessionState<SourceWorkspaceStatus>({
    phase: "checking",
    workspace: null,
    message: "Checking source workspace…",
    busy: false,
    generation: 0,
  });
  let generation = 0;
  let readSequence = 0;
  let scopeKey = "";
  let initializedScope = "";
  let commandInFlight = false;
  let loading: Promise<void> | null = null;
  const pending = new Map<string, string>();
  const update = (patch: Partial<SourceWorkspaceStatus>) =>
    status.update((current) => ({ ...current, ...patch, generation }));
  function merge(sources: ReadonlyArray<WorkspaceSource>) {
    state.update((current) => {
      const byId = { ...current.byId };
      for (const received of sources) {
        const original = originals.get(received.id);
        const existing = byId[received.id];
        if (
          !original ||
          !existing ||
          !Number.isSafeInteger(received.revision) ||
          received.revision < existing.revision
        )
          continue;
        const checked = prepareSourceCommand(
          {
            baseline: originals,
            state: {
              order: [received.id],
              byId: { [received.id]: { record: original, revision: 0 } },
            },
            checkPermission: () => ({ ok: true }),
          },
          {
            type: "edit",
            id: received.id,
            revision: 0,
            metadata: {
              title: received.title,
              description: received.description,
              tags: [...received.tags],
            },
          },
        );
        if (!checked.ok) throw new Error("Workspace metadata is invalid.");
        byId[received.id] = {
          record: checked.next.byId[received.id].record,
          revision: received.revision,
        };
      }
      return { ...current, byId };
    });
  }
  function receiveUnavailable(response: WorkspaceResponse) {
    update({
      phase:
        response.code === "EXPIRED"
          ? "expired"
          : response.code === "DENIED"
            ? "denied"
            : "unavailable",
      message: response.message,
    });
  }
  async function initialize(
    scenario: ScenarioInput,
    force = false,
  ): Promise<void> {
    const key = JSON.stringify(scenario);
    if (!force && key === initializedScope) return;
    if (!force && key === scopeKey && loading) return loading;
    scopeKey = key;
    const sequence = ++readSequence;
    const version = generation;
    const current = () => sequence === readSequence && version === generation;
    update({ phase: "checking" });
    const task = (async () => {
      try {
        const response = await request("WorkspaceStatus", {}, scenario);
        if (!current()) return;
        if (response.code === "LOCAL" && !status.getSnapshot().workspace) {
          update({
            phase: "local",
            workspace: null,
            message: "Changes stay in this browser session.",
          });
        } else if (response.code === "ABSENT") {
          update({
            phase: status.getSnapshot().workspace ? "expired" : "absent",
            message: status.getSnapshot().workspace
              ? "This visitor workspace ended. Start another to save your draft."
              : "Save metadata to start a temporary visitor workspace.",
          });
        } else if (response.code === "OK" && response.workspace) {
          const snapshot = await request("WorkspaceSnapshot", {}, scenario);
          if (!current()) return;
          if (
            snapshot.code === "OK" &&
            snapshot.sources &&
            snapshot.workspace
          ) {
            const previous = status.getSnapshot().workspace;
            if (previous?.id !== snapshot.workspace.id) {
              generation++;
              pending.clear();
              state.update(() => createSourceSession(baseline));
            }
            merge(snapshot.sources);
            update({
              phase: "active",
              workspace: snapshot.workspace,
              message: "Source edits are saved in this visitor workspace.",
            });
          } else receiveUnavailable(snapshot);
        } else receiveUnavailable(response);
        initializedScope = key;
      } catch {
        if (current())
          update({
            phase: "unavailable",
            message:
              "The source workspace could not load. Keep your draft and retry.",
          });
      }
    })();
    loading = task;
    await task;
    if (loading === task) loading = null;
  }
  async function start(
    scenario: ScenarioInput,
    withinCommand = false,
    isCurrent = () => true,
  ): Promise<CommandResult> {
    if (!withinCommand && status.getSnapshot().busy)
      return failure("Finish the current workspace request first.");
    if (!withinCommand) update({ busy: true });
    const version = generation;
    const workspaceId = status.getSnapshot().workspace?.id;
    const current = () =>
      version === generation &&
      workspaceId === status.getSnapshot().workspace?.id &&
      isCurrent();
    try {
      const response = await request("StartWorkspace", {}, scenario);
      if (!current())
        return failure(
          "The workspace or permission scenario changed. Review the current controls and retry.",
        );
      if (response.code !== "OK" || !response.workspace) {
        receiveUnavailable(response);
        return failure(response.message);
      }
      generation++;
      readSequence++;
      pending.clear();
      initializedScope = "";
      state.update(() => createSourceSession(baseline));
      update({
        phase: "active",
        workspace: response.workspace,
        message: "Visitor workspace started.",
      });
      const startedVersion = generation;
      await initialize(scenario, true);
      if (!isCurrent() || startedVersion !== generation)
        return failure(
          "The workspace or permission scenario changed. Your draft is still available.",
        );
      return status.getSnapshot().phase === "active"
        ? { ok: true, changed: false }
        : failure(status.getSnapshot().message);
    } catch {
      const message =
        "The workspace could not start. Keep your draft and retry.";
      if (current()) update({ message });
      return failure(message);
    } finally {
      if (!withinCommand) update({ busy: false });
    }
  }
  async function execute(
    command: SourceCommand,
    context: CommandContext,
  ): Promise<CommandResult> {
    if (commandInFlight || status.getSnapshot().busy)
      return failure("This source request is still running.");
    commandInFlight = true;
    update({ busy: true });
    try {
      await initialize(
        context.scenario,
        status.getSnapshot().phase === "unavailable",
      );
      if (!context.isCurrent())
        return failure(
          "The permission scenario changed. Review the current controls and retry.",
        );
      let current = status.getSnapshot();
      const prepared = prepareSourceCommand(
        {
          baseline: originals,
          state: state.getSnapshot(),
          checkPermission: context.checkPermission,
        },
        command,
      );
      if (!prepared.ok) return prepared;
      if (current.phase === "local") {
        if (prepared.changed) state.update(() => prepared.next);
        return { ok: true, changed: prepared.changed };
      }
      if (current.phase === "absent") {
        const started = await start(context.scenario, true, context.isCurrent);
        if (!started.ok) return started;
        if (!context.isCurrent())
          return failure(
            "The permission scenario changed. Review the current controls and retry.",
          );
        current = status.getSnapshot();
      }
      if (current.phase !== "active" || !current.workspace)
        return failure(current.message);
      const version = generation;
      const workspaceId = current.workspace.id;
      const intent = normalize(command);
      const key = JSON.stringify([
        workspaceId,
        version,
        context.scenario,
        intent,
      ]);
      let idempotencyKey = pending.get(key);
      if (!idempotencyKey) {
        idempotencyKey = newId();
        // Bounded to the server's receipt allowance; obsolete confirmed intents can leave this client cache.
        if (pending.size >= 128) pending.delete(pending.keys().next().value!);
        pending.set(key, idempotencyKey);
      }
      const input = {
        id: intent.id,
        expectedRevision: intent.revision,
        idempotencyKey,
        ...(intent.type === "edit" ? { metadata: intent.metadata } : {}),
      };
      update({ busy: true });
      try {
        const response = await request(
          intent.type === "edit" ? "SaveSource" : "RestoreSource",
          { input },
          context.scenario,
        );
        if (
          version !== generation ||
          status.getSnapshot().workspace?.id !== workspaceId ||
          !context.isCurrent()
        )
          return failure(
            "This workspace or permission scenario changed. Your draft is still available.",
          );
        if (response.code === "OK" && response.source) {
          merge([response.source]);
          const old = status.getSnapshot().workspace!;
          update({
            workspace: response.workspace
              ? {
                  ...response.workspace,
                  eventCount: Math.max(
                    old.eventCount,
                    response.workspace.eventCount,
                  ),
                }
              : old,
            message: response.message,
          });
          return { ok: true, changed: response.changed === true };
        }
        if (response.code === "CONFLICT")
          await initialize(context.scenario, true);
        else if (response.code === "EXPIRED" || response.code === "ABSENT")
          update({ phase: "expired", message: response.message });
        else update({ message: response.message });
        return failure(response.message);
      } catch {
        return failure(
          "The workspace could not confirm this edit. Keep your draft and retry.",
        );
      } finally {
        if (version === generation) update({ busy: false });
      }
    } finally {
      commandInFlight = false;
      update({ busy: false });
    }
  }
  async function reset(
    scenario: ScenarioInput,
    isCurrent = () => true,
  ): Promise<CommandResult> {
    if (status.getSnapshot().busy)
      return failure(
        "Finish the current source request before resetting the workspace.",
      );
    update({ busy: true });
    const version = generation;
    const workspaceId = status.getSnapshot().workspace?.id;
    const current = () =>
      version === generation &&
      workspaceId === status.getSnapshot().workspace?.id &&
      isCurrent();
    try {
      const response = await request("ResetWorkspace", {}, scenario);
      if (!current())
        return failure(
          "The workspace or permission scenario changed. Review the current controls and retry.",
        );
      if (response.code !== "ABSENT") {
        update({ message: response.message });
        return failure(response.message);
      }
      generation++;
      readSequence++;
      pending.clear();
      initializedScope = "";
      state.update(() => createSourceSession(baseline));
      update({
        phase: "absent",
        workspace: null,
        message: "Visitor workspace reset. Save metadata to start another.",
        busy: false,
      });
      return { ok: true, changed: true };
    } catch {
      const message =
        "The workspace could not confirm the reset. Keep your draft and retry.";
      if (current()) update({ message });
      return failure(message);
    } finally {
      update({ busy: false });
    }
  }
  return {
    state,
    status,
    initialize,
    execute,
    start,
    reset,
    history: (sourceId: string, scenario: ScenarioInput) =>
      request("WorkspaceHistory", { sourceId, limit: 10 }, scenario),
  };
}
