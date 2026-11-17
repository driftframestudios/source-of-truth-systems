import { useEffect, useRef } from "react";
import type { WellResult } from "../../types";
import type { StackFocus } from "../plate/plateState";
import { useGuide } from "./GuideProvider";
import type { GuideStep } from "./guideState";

/** A receiver consumes one typed request; unmount, exit and manual input cancel motion. */
export function useGuideScene(
  enabled: boolean,
  receive: (step: GuideStep) => void | (() => void),
) {
  const { request, interruption, ownsRequest } = useGuide();
  const receiver = useRef(receive);
  receiver.current = receive;
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (
      !enabled ||
      !request ||
      !ownsRequest(request.id) ||
      applied.current === request.id
    )
      return;
    applied.current = request.id;
    return receiver.current(request.step);
  }, [enabled, request, interruption, ownsRequest]);
}

/** Guide selection comes from the same scoped history that the view renders. */
export function useGuidePlate({
  active,
  wellId,
  phase,
  results,
  sceneReady,
  setFocus,
}: {
  active: boolean;
  wellId: string | null;
  phase: "idle" | "loading" | "ready" | "unavailable" | "denied";
  results: ReadonlyArray<WellResult>;
  sceneReady: boolean;
  setFocus: (focus: StackFocus | null) => void;
}) {
  const { request, ownsRequest, acknowledge } = useGuide();
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (
      !active ||
      !request ||
      request.step === "workflow" ||
      wellId !== "C3" ||
      !ownsRequest(request.id)
    )
      return;
    if (
      phase === "denied" ||
      phase === "unavailable" ||
      (phase === "ready" && !results.length)
    ) {
      acknowledge(request.id, "unavailable");
      return;
    }
    if (phase !== "ready" || !sceneReady) return;
    if (applied.current !== request.id) {
      const result =
        results.find(
          (item) => item.kind === "reanalysis" && item.status === "reportable",
        ) ??
        results.find((item) => item.status === "reportable") ??
        results[0];
      setFocus({ resultId: result.id, pinned: true });
      applied.current = request.id;
    }
    acknowledge(request.id, "ready");
  }, [
    active,
    request,
    wellId,
    phase,
    results,
    sceneReady,
    setFocus,
    ownsRequest,
    acknowledge,
  ]);
}
