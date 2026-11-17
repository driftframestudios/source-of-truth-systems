import { useEffect, useState } from "react";
import type { MotionValue } from "motion/react";
import type { Camera } from "./plateGeometry";

/** Coalesce camera changes so labels and the record thread follow the rendered plate. */
export function useProjectedCamera(
  values: Readonly<Record<keyof Camera, MotionValue<number>>>,
  snapshot: () => Camera,
  enabled: boolean,
): Camera {
  const [camera, setCamera] = useState(snapshot);
  useEffect(() => {
    if (!enabled) return;
    let frame: number | undefined;
    const update = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        setCamera(snapshot());
      });
    };
    setCamera(snapshot());
    const unsubscribe = Object.values(values).map((value) =>
      value.on("change", update),
    );
    return () => {
      unsubscribe.forEach((stop) => stop());
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [values, snapshot, enabled]);
  return camera;
}
