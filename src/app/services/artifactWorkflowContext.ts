import { useMemo } from "react";
import { STORE } from "../data";
import { createSessionState } from "./browserSession";
import {
  useSessionResource,
  useSessionSnapshot,
} from "./browserSessionContext";
import {
  createArtifactCommands,
  createArtifactWorkflows,
} from "./artifactWorkflows";
import type { ArtifactCommand } from "./artifactWorkflows";
import { useWriteGate } from "./writeGate";
import { useSourceRecordReader } from "./sourceSessionContext";

const ARTIFACT_SESSION = {
  create: () => createSessionState(createArtifactWorkflows(STORE.artifacts)),
};
export function useArtifactRecords() {
  const state = useSessionSnapshot(useSessionResource(ARTIFACT_SESSION));
  return useMemo(() => Object.values(state.byId), [state]);
}
export function useArtifactCommands() {
  const store = useSessionResource(ARTIFACT_SESSION);
  const getSources = useSourceRecordReader();
  const { check, deny } = useWriteGate();
  const commands = useMemo(
    () =>
      createArtifactCommands({
        getState: store.getSnapshot,
        getSources,
        commit: (next) => store.update(() => next),
        checkPermission: check,
      }),
    [store, check, getSources],
  );
  return (command: ArtifactCommand) => {
    const result = commands.execute(command);
    if (!result.ok)
      deny(
        command.type === "check"
          ? "Check artifact references"
          : "Update revision proposal",
        result,
        command.id,
      );
    return result;
  };
}
