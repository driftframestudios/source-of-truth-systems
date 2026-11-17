import { useMemo } from "react";
import { STORE } from "../data";
import { createSessionState } from "./browserSession";
import {
  useSessionResource,
  useSessionSnapshot,
} from "./browserSessionContext";
import { createMapCommands, createMapSession } from "./mapOperations";
import { useWriteGate } from "./writeGate";

const MAP_SESSION = {
  create: () => createSessionState(createMapSession(STORE.graphNodes)),
};

export function useMapOperations() {
  const store = useSessionResource(MAP_SESSION);
  const state = useSessionSnapshot(store);
  const { check } = useWriteGate();
  const commands = useMemo(
    () =>
      createMapCommands({
        getState: store.getSnapshot,
        commit: (next) => {
          store.update(() => next);
        },
        checkPermission: check,
      }),
    [store, check],
  );
  const nodes = useMemo(() => state.order.map((id) => state.byId[id]), [state]);
  return { nodes, commands };
}
