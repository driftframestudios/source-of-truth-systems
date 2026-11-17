import { useCallback, useEffect, useRef } from "react";
import { animate } from "motion/react";
import { nearestCorridorYaw } from "./corridorCamera";
import type { CorridorCamera, CorridorPreset } from "./corridorCamera";

// Discrete navigation gets a small overshoot; direct input keeps exact tracking.
const PRESET_SPRING = {
  type: "spring" as const,
  stiffness: 170,
  damping: 17,
  mass: 1,
  restDelta: 0.001,
  restSpeed: 0.01,
};
const SPRINGS = {
  preset: PRESET_SPRING,
  // A modest damping increase reduces Side's rebound by about 12%.
  side: { ...PRESET_SPRING, damping: 17.45 },
  reset: { ...PRESET_SPRING, stiffness: 260, damping: 24 },
};

export function useCorridorPresetMotion({
  camera,
  onChange,
  enabled,
  reducedMotion,
}: {
  camera: CorridorCamera;
  onChange: (camera: CorridorCamera) => void;
  enabled: boolean;
  reducedMotion: boolean;
}) {
  const current = useRef(camera);
  current.current = camera;
  const publish = useRef(onChange);
  publish.current = onChange;
  const animation = useRef<{ stop: () => void } | null>(null);
  const target = useRef<CorridorCamera | null>(null);
  const generation = useRef(0);

  const cancel = useCallback(() => {
    generation.current++;
    animation.current?.stop();
    animation.current = null;
    target.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) cancel();
    else if (reducedMotion && target.current) {
      const destination = target.current;
      cancel();
      current.current = destination;
      publish.current(destination);
    }
  }, [enabled, reducedMotion, cancel]);
  useEffect(() => cancel, [cancel]);

  const moveTo = useCallback(
    (pose: CorridorCamera, spring: keyof typeof SPRINGS, onSettled?: () => void) => {
      cancel();
      const from = current.current;
      const destination = {
        ...pose,
        yaw: nearestCorridorYaw(pose.yaw, from.yaw),
      };
      if (
        !enabled ||
        reducedMotion ||
        (from.pitch === destination.pitch && from.yaw === destination.yaw &&
          from.panX === destination.panX && from.panY === destination.panY && from.zoom === destination.zoom)
      ) {
        current.current = destination;
        publish.current(destination);
        onSettled?.();
        return;
      }
      target.current = destination;
      const run = generation.current;
      animation.current = animate(0, 1, {
        ...SPRINGS[spring],
        onUpdate(progress) {
          if (run !== generation.current) return;
          const next = {
            pitch: from.pitch + (destination.pitch - from.pitch) * progress,
            yaw: from.yaw + (destination.yaw - from.yaw) * progress,
            panX: from.panX + (destination.panX - from.panX) * progress,
            panY: from.panY + (destination.panY - from.panY) * progress,
            zoom: from.zoom + (destination.zoom - from.zoom) * progress,
          };
          current.current = next;
          publish.current(next);
        },
        onComplete() {
          if (run !== generation.current) return;
          animation.current = null;
          target.current = null;
          current.current = destination;
          publish.current(destination);
          onSettled?.();
        },
      });
    },
    [enabled, reducedMotion, cancel],
  );

  const select = useCallback((preset: CorridorPreset) => {
    moveTo({ ...current.current, pitch: preset.pitch, yaw: preset.yaw }, preset.spring);
  }, [moveTo]);
  const reset = useCallback((pose: CorridorCamera, onSettled?: () => void) => moveTo(pose, 'reset', onSettled), [moveTo]);

  return { select, reset, cancel };
}
