import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createBrowserSession } from './browserSession';
import type { SessionResource, SessionState } from './browserSession';

const BrowserSession = createContext<ReturnType<typeof createBrowserSession> | null>(null);

export function BrowserSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(createBrowserSession);
  return <BrowserSession.Provider value={session}>{children}</BrowserSession.Provider>;
}

export function useSessionResource<T>(resource: SessionResource<T>): T {
  const session = useContext(BrowserSession);
  if (!session) throw new Error('Accepted state requires BrowserSessionProvider.');
  return session.get(resource);
}

export function useSessionSnapshot<T>(state: SessionState<T>): T {
  return useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot);
}
