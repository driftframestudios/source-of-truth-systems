import { ArrowLeft, ArrowRight, Pause, Play, X } from "lucide-react";
import { ShowcaseCredit } from "../ShowcaseCredit";
import { DeveloperDocsLink } from "../DeveloperDocsLink";
import { useGuide } from "./GuideProvider";
import { GUIDE_STEPS } from "./guideState";

const CHAPTERS = {
  workflow: {
    label: "Follow the work",
    question: "Where does a sample go?",
    copy: "Follow the corridor from laboratory work to analysis and interpretation. The steps keep the work and its supporting records together.",
    try: "Drag the corridor or choose a view to look around.",
  },
  history: {
    label: "Compare runs",
    question: "Why was this result revisited?",
    copy: "C3 brings earlier and later results into one history. Select a result to read why it was created and what changed.",
    try: "Select another disc to compare its reason and findings.",
  },
  resources: {
    label: "Find the data",
    question: "What data do we need now?",
    copy: "Look at the files behind the result: some are ready, some are stored, and some reuse earlier reads. Those choices affect waiting time, storage and computing work.",
    try: "Inspect Files and Lifecycle; choose what you want to explore next.",
  },
} as const;

export default function GuidePanel() {
  const { state, send, start, reducedMotion, ownsRequest } = useGuide();
  if (state.phase === "closed") return null;
  if (state.phase === "invitation")
    return (
      <aside
        className="guide-invitation"
        data-guide
        aria-labelledby="guide-invitation-title"
      >
        <button
          type="button"
          className="guide-close"
          aria-label="Dismiss guide invitation"
          onClick={() => send({ type: "close" })}
        >
          <X size={17} />
        </button>
        <span className="guide-eyebrow">
          Source of Truth · for Life Sciences
        </span>
        <h2 id="guide-invitation-title">Follow a sample.</h2>
        <p>
          See how laboratory work, result histories and the files behind them
          fit together.
        </p>
        <div className="guide-choices">
          {GUIDE_STEPS.map((step, index) => (
            <button key={step} type="button" onClick={() => start(step)}>
              <span>{index + 1}</span>
              {CHAPTERS[step].question}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
        <div className="guide-actions">
          <button
            type="button"
            className="guide-primary"
            onClick={() => start("workflow", true)}
          >
            <Play size={14} />
            {reducedMotion ? "Explore step by step" : "Watch walkthrough"}
          </button>
          <button type="button" onClick={() => send({ type: "close" })}>
            Explore on my own
          </button>
        </div>
        <p className="guide-footnote">
          Three short scenes with example data. Pause or take control at any
          point. Open Guide to return.
        </p>
        <DeveloperDocsLink />
        <ShowcaseCredit />
      </aside>
    );

  if (state.phase !== "touring") return null;
  const chapter = CHAPTERS[state.step];
  const index = GUIDE_STEPS.indexOf(state.step);
  return (
    <section
      className="guide-rail"
      data-guide
      aria-label="Follow a sample guide"
      data-step={state.step}
    >
      <div className="guide-narrative" aria-live="polite">
        <span className="guide-eyebrow">
          Follow a sample · {index + 1} of {GUIDE_STEPS.length}
        </span>
        <h2>{chapter.question}</h2>
        <p>{chapter.copy}</p>
        <span className="guide-hint">
          {!ownsRequest(state.requestId)
            ? "You’re in control. Choose a scene to return to the guide."
            : state.readiness === "unavailable"
              ? "This example is unavailable in the current view or access scope. Use the view’s recovery controls or choose another scene."
              : state.readiness === "pending"
                ? "Opening the view…"
                : chapter.try}
        </span>
      </div>
      <div className="guide-transport">
        <nav aria-label="Guide scenes">
          {GUIDE_STEPS.map((step, index) => (
            <button
              key={step}
              type="button"
              aria-current={state.step === step ? "step" : undefined}
              onClick={() => send({ type: "select", step })}
            >
              <span>{index + 1}</span>
              {CHAPTERS[step].label}
            </button>
          ))}
        </nav>
        <div className="guide-actions">
          <button
            type="button"
            aria-label="Previous guide scene"
            disabled={index === 0}
            onClick={() => send({ type: "back" })}
          >
            <ArrowLeft size={14} />
          </button>
          {!ownsRequest(state.requestId) && (
            <button
              type="button"
              onClick={() => send({ type: "select", step: state.step })}
            >
              Show this scene
            </button>
          )}
          {!reducedMotion && (
            <button
              type="button"
              disabled={state.readiness !== "ready"}
              onClick={() => send({ type: state.playing ? "pause" : "play" })}
            >
              {state.playing ? <Pause size={14} /> : <Play size={14} />}
              {state.playing ? "Pause" : "Play"}
            </button>
          )}
          {index < GUIDE_STEPS.length - 1 && (
            <button type="button" onClick={() => send({ type: "next" })}>
              Next
              <ArrowRight size={14} />
            </button>
          )}
          <button type="button" onClick={() => send({ type: "pause" })}>
            Try it myself
          </button>
          <button type="button" onClick={() => send({ type: "close" })}>
            {index === GUIDE_STEPS.length - 1
              ? "Keep exploring"
              : "Close guide"}
            <X size={14} />
          </button>
        </div>
        {state.playing && state.readiness === "ready" && (
          <div
            className="guide-progress"
            key={state.requestId}
            aria-hidden="true"
          >
            <i />
          </div>
        )}
      </div>
    </section>
  );
}
