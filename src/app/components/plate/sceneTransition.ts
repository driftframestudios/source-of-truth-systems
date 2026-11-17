interface TransitionScheduler {
  delay: (callback: () => void, milliseconds: number) => number;
  clearDelay: (id: number) => void;
  frame: (callback: () => void) => number;
  clearFrame: (id: number) => void;
}

/** A plate transition owns its animations, release delay and extrusion frame. */
export function createSceneTransition(scheduler: TransitionScheduler) {
  let generation = 0;
  const pending = new Set<() => void>();
  const cancel = () => {
    generation++;
    for (const stop of [...pending]) stop();
    pending.clear();
  };
  const own = (stop: () => void) => {
    pending.add(stop);
    return () => { pending.delete(stop); };
  };
  return {
    begin() { cancel(); return generation; },
    current: (run: number) => run === generation,
    cancel,
    own,
    delay(milliseconds: number): Promise<void> {
      return new Promise((resolve) => {
        const id = scheduler.delay(() => { forget(); resolve(); }, milliseconds);
        const forget = own(() => { scheduler.clearDelay(id); resolve(); });
      });
    },
    frame(callback: () => void) {
      const id = scheduler.frame(() => { forget(); callback(); });
      const forget = own(() => scheduler.clearFrame(id));
    },
  };
}
