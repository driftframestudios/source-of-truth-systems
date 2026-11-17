export const GUIDE_STEPS = ["workflow", "history", "resources"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];
export type GuideReadiness = "pending" | "ready" | "unavailable";

export type GuideState =
  | { readonly phase: "closed" | "invitation"; readonly requestId: number }
  | {
      readonly phase: "touring";
      readonly step: GuideStep;
      readonly playing: boolean;
      readonly readiness: GuideReadiness;
      readonly requestId: number;
    };

export type GuideAction =
  | { readonly type: "invite" | "close" | "pause" | "play" | "back" }
  | {
      readonly type: "start";
      readonly step?: GuideStep;
      readonly playing?: boolean;
    }
  | { readonly type: "select"; readonly step: GuideStep }
  | { readonly type: "next"; readonly automatic?: false }
  | {
      readonly type: "next";
      readonly automatic: true;
      readonly requestId: number;
    }
  | {
      readonly type: "acknowledge";
      readonly requestId: number;
      readonly readiness: Exclude<GuideReadiness, "pending">;
    };

export function createGuideState(): GuideState {
  return { phase: "closed", requestId: 0 };
}

function requestStep(
  state: GuideState,
  step: GuideStep,
  playing: boolean,
): GuideState {
  return {
    phase: "touring",
    step,
    playing,
    readiness: "pending",
    requestId: state.requestId + 1,
  };
}

/** Readiness belongs to one requested scene; playback never owns application data. */
export function guideReducer(
  state: GuideState,
  action: GuideAction,
): GuideState {
  switch (action.type) {
    case "invite":
      return state.phase === "invitation"
        ? state
        : { phase: "invitation", requestId: state.requestId };
    case "close":
      return state.phase === "closed"
        ? state
        : { phase: "closed", requestId: state.requestId };
    case "start":
      return requestStep(
        state,
        action.step ?? "workflow",
        action.playing ?? false,
      );
    case "select":
      return state.phase === "touring"
        ? requestStep(state, action.step, state.playing)
        : state;
    case "back": {
      if (state.phase !== "touring") return state;
      const index = GUIDE_STEPS.indexOf(state.step);
      return index > 0
        ? requestStep(state, GUIDE_STEPS[index - 1], state.playing)
        : state;
    }
    case "next": {
      if (state.phase !== "touring") return state;
      if (
        action.automatic &&
        (action.requestId !== state.requestId ||
          !state.playing ||
          state.readiness !== "ready")
      )
        return state;
      const next = GUIDE_STEPS[GUIDE_STEPS.indexOf(state.step) + 1];
      // The final scene stays available for Keep exploring; replay is an explicit Start.
      return next
        ? requestStep(state, next, state.playing)
        : state.playing
          ? { ...state, playing: false }
          : state;
    }
    case "pause":
      return state.phase === "touring" && state.playing
        ? { ...state, playing: false }
        : state;
    case "play":
      return state.phase === "touring" &&
        !state.playing &&
        state.readiness !== "unavailable"
        ? { ...state, playing: true }
        : state;
    case "acknowledge":
      if (state.phase !== "touring" || action.requestId !== state.requestId)
        return state;
      if (state.readiness === action.readiness) return state;
      return {
        ...state,
        readiness: action.readiness,
        playing: action.readiness === "unavailable" ? false : state.playing,
      };
  }
}

export const GUIDE_PREFERENCE_KEY = "sot:guide:v1";

interface GuidePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Only the welcome preference is read; accepted records and permission scope stay elsewhere. */
export function readGuideSeen(
  storage?: Pick<GuidePreferenceStorage, "getItem"> | null,
): boolean {
  try {
    return storage?.getItem(GUIDE_PREFERENCE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function markGuideSeen(
  storage?: Pick<GuidePreferenceStorage, "setItem"> | null,
): void {
  try {
    storage?.setItem(GUIDE_PREFERENCE_KEY, "seen");
  } catch {
    // A blocked preference store leaves this guide session available.
  }
}
