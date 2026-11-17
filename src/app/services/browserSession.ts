/** Feature factories stay in their deferred modules; this owner holds only accepted instances. */
export interface SessionResource<T> {
  readonly create: () => T;
}

export function createBrowserSession() {
  const resources = new Map<SessionResource<unknown>, unknown>();
  return {
    get<T>(resource: SessionResource<T>): T {
      if (!resources.has(resource)) resources.set(resource, resource.create());
      // The factory object is the key: only its own return value enters this slot.
      return resources.get(resource) as T;
    },
  };
}

/** Stable immutable snapshots serve mounted receivers without owning their lifetime. */
export function createSessionState<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    update(reduce: (current: T) => T): boolean {
      const next = reduce(snapshot);
      if (Object.is(next, snapshot)) return false;
      snapshot = next;
      listeners.forEach((listener) => listener());
      return true;
    },
  };
}

export type SessionState<T> = ReturnType<typeof createSessionState<T>>;
