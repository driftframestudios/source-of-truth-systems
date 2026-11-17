import { useMemo } from "react";
import { STORE } from "../data";
import { createSessionState } from "./browserSession";
import {
  useSessionResource,
  useSessionSnapshot,
} from "./browserSessionContext";
import { cohortFacetOptions } from "./cohortRules";
import { createCohortCommands } from "./cohortSession";
import type { CohortSession } from "./cohortSession";
import { useWriteGate } from "./writeGate";

const COHORT_SESSION = {
  create: () => createSessionState<CohortSession>({ rules: [] }),
};
export function useCohortSession() {
  const store = useSessionResource(COHORT_SESSION);
  const state = useSessionSnapshot(store);
  const { check } = useWriteGate();
  const commands = useMemo(
    () =>
      createCohortCommands({
        getState: store.getSnapshot,
        commit: (next) => {
          store.update(() => next);
        },
        options: cohortFacetOptions(STORE.specimens),
        newId: () => `cohort-${crypto.randomUUID()}`,
        checkPermission: check,
      }),
    [store, check],
  );
  return { state, commands };
}
