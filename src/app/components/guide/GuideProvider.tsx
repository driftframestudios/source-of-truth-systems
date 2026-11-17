import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Compass } from "lucide-react";
import { LoadBoundary } from "../DeferredView";
import {
  useExplorationNavigation,
  usePlateExploration,
} from "../../services/exploration/ExplorationProvider";
import {
  createGuideState,
  guideReducer,
  markGuideSeen,
  readGuideSeen,
} from "./guideState";
import type { GuideAction, GuideStep } from "./guideState";
import "./guide.css";

const GuidePanel = lazy(() => import("./GuidePanel"));
const READING_INTERVAL_MS = 16_000;
const GuideContext = createContext<ReturnType<typeof useGuideOwner> | null>(
  null,
);
const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

function useGuideOwner() {
  const [state, dispatch] = useReducer(guideReducer, undefined, () => {
    const initial = createGuideState();
    return readGuideSeen(browserStorage())
      ? initial
      : guideReducer(initial, { type: "invite" });
  });
  const current = useRef(state);
  current.current = state;
  const interrupted = useRef<number | null>(null);
  const [prepared, setPrepared] = useState<number | null>(null);
  const [interruption, setInterruption] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const { selectScene } = useExplorationNavigation();
  const { setPlateUi, setSelectedWellId, setFocus, setCompactPlateView } =
    usePlateExploration();
  const owned = useRef<number | null>(null);

  const send = useCallback((action: GuideAction) => {
    if (
      action.type === "play" &&
      current.current.phase === "touring" &&
      interrupted.current === current.current.requestId
    ) {
      dispatch({ type: "start", step: current.current.step, playing: true });
      return;
    }
    if (
      action.type === "close" ||
      action.type === "pause" ||
      action.type === "invite"
    ) {
      interrupted.current = current.current.requestId;
      setInterruption((value) => value + 1);
    }
    dispatch(action);
  }, []);
  const ownsRequest = useCallback(
    (id: number) =>
      current.current.phase === "touring" &&
      current.current.requestId === id &&
      interrupted.current !== id,
    [],
  );
  const acknowledge = useCallback(
    (requestId: number, readiness: "ready" | "unavailable") =>
      dispatch({ type: "acknowledge", requestId, readiness }),
    [],
  );

  useEffect(() => {
    markGuideSeen(browserStorage());
  }, []);

  // One navigation command per explicit step. Responsive receivers share intent.
  useEffect(() => {
    if (state.phase !== "touring" || owned.current === state.requestId) return;
    owned.current = state.requestId;
    interrupted.current = null;
    if (state.step === "workflow") selectScene("corridor", "desktop");
    else {
      selectScene("plate", "desktop");
      setCompactPlateView("3d");
      setSelectedWellId("C3");
      setFocus(null);
      setPlateUi((previous) => ({
        ...previous,
        upright: true,
        lens: state.step === "resources" ? "storage" : "kind",
        onlyMulti: false,
      }));
    }
    setPrepared(state.requestId);
  }, [
    state,
    selectScene,
    setCompactPlateView,
    setSelectedWellId,
    setFocus,
    setPlateUi,
  ]);

  useEffect(() => {
    const pause = () => {
      if (current.current.phase === "touring") send({ type: "pause" });
    };
    const interact = (event: Event) => {
      if ((event.target as Element | null)?.closest?.("[data-guide]")) return;
      if (current.current.phase === "invitation") send({ type: "close" });
      else pause();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && current.current.phase !== "closed") {
        send({ type: "close" });
      } else if (
        !["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)
      )
        interact(event);
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => {
      setReducedMotion(reduced.matches);
      if (reduced.matches) pause();
    };
    document.addEventListener("pointerdown", interact, true);
    document.addEventListener("wheel", interact, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", key, true);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    reduced.addEventListener("change", preference);
    return () => {
      document.removeEventListener("pointerdown", interact, true);
      document.removeEventListener("wheel", interact, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
      reduced.removeEventListener("change", preference);
    };
  }, [send]);

  useEffect(() => {
    if (
      state.phase !== "touring" ||
      !state.playing ||
      state.readiness !== "ready" ||
      document.hidden
    )
      return;
    const timer = window.setTimeout(
      () =>
        dispatch({ type: "next", automatic: true, requestId: state.requestId }),
      READING_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  const start = useCallback((step: GuideStep = "workflow", playing = false) => {
    dispatch({
      type: "start",
      step,
      playing:
        playing &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);
  const request = useMemo(
    () =>
      state.phase === "touring" && prepared === state.requestId
        ? { id: state.requestId, step: state.step }
        : null,
    [
      state.phase,
      state.requestId,
      state.phase === "touring" ? state.step : null,
      prepared,
    ],
  );
  return useMemo(
    () => ({
      state,
      request,
      interruption,
      reducedMotion,
      send,
      start,
      ownsRequest,
      acknowledge,
    }),
    [
      state,
      request,
      interruption,
      reducedMotion,
      send,
      start,
      ownsRequest,
      acknowledge,
    ],
  );
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const value = useGuideOwner();
  return (
    <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
  );
}

export function useGuide() {
  const value = useContext(GuideContext);
  if (!value) throw new Error("GuideProvider is required");
  return value;
}

export function GuideButton() {
  const { state, send } = useGuide();
  return (
    <button
      type="button"
      data-guide
      className="guide-trigger"
      aria-expanded={state.phase !== "closed"}
      onClick={() => send({ type: "invite" })}
    >
      <Compass size={14} aria-hidden="true" />
      <span>Guide</span>
    </button>
  );
}

export function GuideSlot() {
  const { state, send } = useGuide();
  return state.phase === "closed" ? null : (
    <LoadBoundary
      label="guide"
      fallback={
        <aside data-guide className="guide-rail" role="alert">
          The guide couldn’t load. You can keep exploring.
          <div className="guide-actions">
            <button onClick={() => send({ type: "close" })}>Close guide</button>
            <button onClick={() => window.location.reload()}>
              Reload to retry
            </button>
          </div>
        </aside>
      }
    >
      <Suspense fallback={null}>
        <GuidePanel />
      </Suspense>
    </LoadBoundary>
  );
}
