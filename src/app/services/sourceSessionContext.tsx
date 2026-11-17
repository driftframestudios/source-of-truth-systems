import { useCallback, useMemo, useEffect } from "react";
import { STORE } from "../data";
import type { SourceType } from "../types";
import { createSessionState } from "./browserSession";
import {
  useSessionResource,
  useSessionSnapshot,
} from "./browserSessionContext";
import { selectSources } from "./sourceSession";
import { useWriteGate } from "./writeGate";
import { createSourceWorkspace } from "./sourceWorkspace";
import { usePermissionScope } from "./permissionScenario";
import { scenarioInput } from "./permissionScope";
import { createSourceEditor } from "./sourceEditor";

const SOURCE_EDITOR = { create: createSourceEditor };

const SOURCE_SESSION = {
  create: () => createSourceWorkspace({ baseline: STORE.sources }),
};
const SOURCE_REGISTRY = {
  create: () =>
    createSessionState<{
      filter: SourceType | "all";
      query: string;
      selectedId: string | null;
    }>({ filter: "all", query: "", selectedId: null }),
};

/** Read-only consumers share accepted records without mounting an editing provider. */
export function useSourceRecords() {
  const owner = useSourceOwner();
  const state = useSessionSnapshot(owner.state);
  return useMemo(() => selectSources(state), [state]);
}

/** Command owners read current accepted metadata when the visitor acts. */
export function useSourceRecordReader() {
  const owner = useSourceOwner();
  return useCallback(() => selectSources(owner.state.getSnapshot()), [owner]);
}

function useSourceOwner() {
  const owner = useSessionResource(SOURCE_SESSION);
  const { key, getScope } = usePermissionScope();
  useEffect(() => {
    void owner.initialize(scenarioInput(getScope()));
  }, [owner, key, getScope]);
  return owner;
}

export function useSourceSession() {
  const owner = useSourceOwner();
  const state = useSessionSnapshot(owner.state);
  const workspace = useSessionSnapshot(owner.status);
  const { check } = useWriteGate();
  const { key: scopeKey, getScope } = usePermissionScope();
  const commands = useMemo(
    () => ({
      execute: (command: import("./sourceSession").SourceCommand) => {
        const current = getScope();
        return owner.execute(command, {
          scenario: scenarioInput(current),
          checkPermission: check,
          isCurrent: () => getScope().key === current.key,
        });
      },
    }),
    [owner, check, getScope],
  );
  const records = useMemo(() => selectSources(state), [state]);
  const history = useCallback(
    (id: string) => owner.history(id, scenarioInput(getScope())),
    [owner, getScope],
  );
  return {
    state,
    records,
    commands,
    workspace,
    scopeKey,
    retry: () => owner.initialize(scenarioInput(getScope()), true),
    start: () => {
      const current = getScope();
      return owner.start(
        scenarioInput(current),
        false,
        () => getScope().key === current.key,
      );
    },
    reset: () => {
      const current = getScope();
      return owner.reset(
        scenarioInput(current),
        () => getScope().key === current.key,
      );
    },
    history,
  };
}

export function useSourceRegistry() {
  const store = useSessionResource(SOURCE_REGISTRY);
  const state = useSessionSnapshot(store);
  return { state, update: store.update };
}

export function useSourceEditor() {
  const owner = useSessionResource(SOURCE_EDITOR);
  return { owner, state: useSessionSnapshot(owner.state) };
}
