import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { STORE } from '../data';
import { createRecordSession, selectBiomarkerConsent, selectBiomarkers, selectSpecimens } from './recordSession';
import type { RecordSessionState } from './recordSession';
import { createRecordCommands } from './recordCommands';
import { useWriteGate } from './writeGate';
import { createSessionState } from './browserSession';
import { useSessionResource, useSessionSnapshot } from './browserSessionContext';

const StateContext = createContext<RecordSessionState | null>(null);
const CommandContext = createContext<ReturnType<typeof createRecordCommands> | null>(null);
const RECORD_SESSION = { create: () => createSessionState(createRecordSession(STORE)) };

export function RecordSessionProvider({ children }: { children: ReactNode }) {
  const store = useSessionResource(RECORD_SESSION);
  const state = useSessionSnapshot(store);
  const { check } = useWriteGate();
  const commands = useMemo(() => createRecordCommands({
    getState: store.getSnapshot,
    commit: (next) => { store.update(() => next); },
    checkPermission: check,
  }), [store, check]);
  return <CommandContext.Provider value={commands}><StateContext.Provider value={state}>{children}</StateContext.Provider></CommandContext.Provider>;
}

function useRecordSession() {
  const state = useContext(StateContext);
  if (!state) throw new Error('Record session views require RecordSessionProvider.');
  return state;
}

export function useRecordCommands() {
  const commands = useContext(CommandContext);
  if (!commands) throw new Error('Record session actions require RecordSessionProvider.');
  return commands;
}

export function useBiomarkers() {
  const state = useRecordSession();
  return useMemo(() => selectBiomarkers(state), [state.biomarkers]);
}

export function useBiomarkerConsent(specimenId: string) {
  return selectBiomarkerConsent(useRecordSession(), specimenId);
}

export function useSpecimens() {
  const state = useRecordSession();
  return useMemo(() => selectSpecimens(state), [state.specimens]);
}
