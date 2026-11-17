import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { STORE } from "../data";
import type { Comparison } from "../types";
import { useWriteGate } from "./writeGate";
import {
  applyComparisonDecision,
  COMPARISON_ACTIONS,
  createComparisonSession,
  selectComparisons,
} from "./comparisonSession";
import type { ComparisonEvent } from "./comparisonSession";
import { createSessionState } from './browserSession';
import { useSessionResource, useSessionSnapshot } from './browserSessionContext';

interface ComparisonContextValue {
  readonly comparisons: ReadonlyArray<Comparison>;
  decide: (id: string, event: ComparisonEvent) => void;
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null);
const COMPARISON_SESSION = { create: () => createSessionState(createComparisonSession(STORE.comparisons)) };

export function ComparisonSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const store = useSessionResource(COMPARISON_SESSION);
  const state = useSessionSnapshot(store);
  const { check, deny } = useWriteGate();
  const decide = useCallback(
    (id: string, event: ComparisonEvent) => {
      // Permission is evaluated at the command owner, including after a role or environment change.
      const access = check({ subjectId: id });
      if (!access.ok) {
        deny(`${COMPARISON_ACTIONS[event].label} comparison`, access, id);
        return;
      }
      store.update((current) =>
        applyComparisonDecision(current, { id, event }, access),
      );
    },
    [check, deny, store],
  );
  const comparisons = useMemo(() => selectComparisons(state), [state]);
  const value = useMemo(() => ({ comparisons, decide }), [comparisons, decide]);
  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparisonSession(): ComparisonContextValue {
  const context = useContext(ComparisonContext);
  if (!context)
    throw new Error("Comparison views require ComparisonSessionProvider.");
  return context;
}
