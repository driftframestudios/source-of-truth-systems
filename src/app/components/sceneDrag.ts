export type SceneDragMode = 'orbit' | 'pan';
export interface SceneDragDelta { dx: number; dy: number; mode: SceneDragMode }

/** One pointer owns a desktop camera drag until release or interruption. */
export function createSceneDrag(threshold: number) {
  let active: { id: number; x: number; y: number; mode: SceneDragMode; moved: boolean } | null = null;
  return {
    begin(id: number, x: number, y: number, mode: SceneDragMode) {
      if (active) return false;
      active = { id, x, y, mode, moved: false };
      return true;
    },
    move(id: number, x: number, y: number): SceneDragDelta | null {
      if (!active || active.id !== id) return null;
      const dx = x - active.x;
      const dy = y - active.y;
      if (!active.moved && Math.hypot(dx, dy) < threshold) return null;
      active.moved = true;
      active.x = x;
      active.y = y;
      return { dx, dy, mode: active.mode };
    },
    end(id: number) {
      if (!active || active.id !== id) return null;
      const ended = active;
      active = null;
      return ended;
    },
    reset() {
      const ended = active;
      active = null;
      return ended;
    },
    isDragging() { return active?.moved ?? false; },
  };
}
