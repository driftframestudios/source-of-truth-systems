import { useMemo } from 'react';
import { STORE } from '../data';
import { createSessionState } from './browserSession';
import { useSessionResource, useSessionSnapshot } from './browserSessionContext';
import { createReleaseCommands, createReleaseWorkflows } from './releaseWorkflows';
import type { ReleaseCommand } from './releaseWorkflows';
import { useWriteGate } from './writeGate';

const INITIAL = createReleaseWorkflows(STORE.instructions, STORE.decisions);
const RELEASE_SESSION = { create: () => createSessionState(INITIAL) };
export function useReleaseRecords() {
  const store = useSessionResource(RELEASE_SESSION);
  const state = useSessionSnapshot(store);
  return useMemo(() => ({
    requirements: Object.values(state.requirements),
    decisions: Object.values(state.decisions),
  }), [state]);
}
export function useReleaseCommands() {
  const store = useSessionResource(RELEASE_SESSION);
  const { check, deny } = useWriteGate();
  const commands = useMemo(() => createReleaseCommands({
    initial: INITIAL, getState: store.getSnapshot,
    commit: next => store.update(() => next), checkPermission: check,
  }), [store, check]);
  return (command: ReleaseCommand) => {
    const result = commands.execute(command);
    if (!result.ok) deny('Update release record', result, command.id);
    return result;
  };
}
