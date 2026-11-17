// Most of the pitch travel keeps the meaningful lane surface facing the visitor.
// A small range beyond the horizon still permits a shallow underside view.
export const CORRIDOR_PITCH = { min: 0, max: 100 } as const;
export const CORRIDOR_PRESETS = [
  { label: 'Top', pitch: 0, yaw: 0, spring: 'preset' },
  { label: 'Isometric', pitch: 56, yaw: -32, spring: 'preset' },
  { label: 'Side', pitch: 90, yaw: -90, spring: 'side' },
] as const satisfies ReadonlyArray<CorridorPreset>;

export interface CorridorAngles {
  pitch: number;
  yaw: number;
}

export interface CorridorCamera extends CorridorAngles {
  panX: number;
  panY: number;
  zoom: number;
}

export interface CorridorPreset extends CorridorAngles {
  label: string;
  spring: 'preset' | 'side';
}

export function clampCorridorPitch(pitch: number) {
  return Math.max(CORRIDOR_PITCH.min, Math.min(CORRIDOR_PITCH.max, pitch));
}

/** Keep the rendered rotation continuous; wrap only its control/readout value. */
export function displayCorridorYaw(yaw: number) {
  return ((yaw + 180) % 360 + 360) % 360 - 180;
}

/** Sliders and presets choose the nearest equivalent turn rather than a full spin. */
export function nearestCorridorYaw(target: number, current: number) {
  return current + displayCorridorYaw(target - current);
}

export function orbitCorridor(
  pitch: number,
  yaw: number,
  dx: number,
  dy: number,
  sensitivity = 0.4,
) {
  return {
    pitch: clampCorridorPitch(pitch - dy * sensitivity),
    yaw: yaw + dx * sensitivity,
  };
}
