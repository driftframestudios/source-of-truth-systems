interface FrameScheduler {
  now: () => number;
  request: (callback: (time: number) => void) => number;
  cancel: (id: number) => void;
}

/** Starts one eligible loop; its owner decides when the scene is visible/active. */
export function startSceneLoop(onFrame: (elapsed: number) => void, scheduler: FrameScheduler) {
  let active = true;
  let previous = scheduler.now();
  let request = 0;
  const tick = (time: number) => {
    if (!active) return;
    const elapsed = time - previous;
    previous = time;
    onFrame(elapsed);
    if (active) request = scheduler.request(tick);
  };
  request = scheduler.request(tick);
  return () => {
    active = false;
    scheduler.cancel(request);
  };
}
