export interface PointerPoint {
  x: number;
  y: number;
}

export interface CorridorGestureDelta {
  dx: number;
  dy: number;
  zoomRatio: number;
  pinch: boolean;
}

// Keep the two active contacts together: each update uses the previous pair's
// distance and midpoint, including when one finger lifts or is cancelled.
export function createCorridorGesture() {
  const points = new Map<number, PointerPoint>();
  let origin: PointerPoint | null = null;
  let moved = false;

  return {
    begin(id: number, point: PointerPoint) {
      if (points.size >= 2 || points.has(id)) return;
      if (points.size === 0) {
        origin = point;
        moved = false;
      } else {
        // A two-finger contact is a camera gesture, even before it moves.
        moved = true;
      }
      points.set(id, point);
    },
    move(id: number, point: PointerPoint): CorridorGestureDelta | null {
      const previous = points.get(id);
      if (!previous || !origin) return null;
      if (!moved && Math.hypot(point.x - origin.x, point.y - origin.y) < 5) return null;
      moved = true;
      const other = [...points.entries()].find(([pointerId]) => pointerId !== id)?.[1];
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      points.set(id, point);
      if (!other) return { dx, dy, zoomRatio: 1, pinch: false };
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(point.x - other.x, point.y - other.y);
      return { dx: dx / 2, dy: dy / 2, zoomRatio: before > 1 ? after / before : 1, pinch: true };
    },
    end(id: number) {
      if (!points.delete(id)) return false;
      const suppressClick = moved;
      if (points.size === 0) {
        origin = null;
        moved = false;
      }
      return suppressClick;
    },
    reset() {
      const ids = [...points.keys()];
      points.clear();
      origin = null;
      moved = false;
      return ids;
    },
  };
}
