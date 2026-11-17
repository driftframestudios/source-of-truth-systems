import { useMemo } from "react";
import { STORE } from "../data";
import { createSessionState } from "./browserSession";
import {
  useSessionResource,
  useSessionSnapshot,
} from "./browserSessionContext";
import { createQcReviewCommands, createQcReviews } from "./qcReviews";
import { useWriteGate } from "./writeGate";

const QC_SESSION = {
  create: () => createSessionState(createQcReviews(STORE.qcGates)),
};

export function useQcReviews() {
  const store = useSessionResource(QC_SESSION);
  const state = useSessionSnapshot(store);
  const { check } = useWriteGate();
  const commands = useMemo(
    () =>
      createQcReviewCommands({
        gates: STORE.qcGates,
        getState: store.getSnapshot,
        commit: (next) => {
          store.update(() => next);
        },
        checkPermission: check,
      }),
    [store, check],
  );
  return { reviews: state.byId, commands };
}
