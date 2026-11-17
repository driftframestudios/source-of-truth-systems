import { useCorridorReadScope } from "../../services/useCorridorReadScope";
import { useGuide } from '../guide/GuideProvider';
import { useGuideScene } from '../guide/useGuideScene';
import { createPortal } from "react-dom";
import { lazy, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Move,
  Orbit,
  RotateCcw,
  SlidersHorizontal,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { STORE } from "../../data";
import type { LaneId } from "../../types";
import {
  cardStyle,
  CorridorScene,
  DEFAULT_CONTROL,
  LANE_LENGTH_PX,
} from "../corridor/CorridorScene";
import {
  CORRIDOR_PITCH,
  clampCorridorPitch,
  orbitCorridor,
} from "../corridor/corridorCamera";
import { useCorridorPresetMotion } from "../corridor/useCorridorPresetMotion";
import type { SetStateAction } from "react";
import type { MobileCorridorCamera } from "./corridorView";
import { createCorridorGesture } from "./corridorGesture";
import { DeferredView } from "../DeferredView";
import { startSceneLoop } from "../sceneLoop";
import { useDocumentVisible } from "../useDocumentVisible";
import {
  CORRIDOR_STAGES as STAGES,
  INITIAL_MOBILE_CAMERA as INITIAL_CAMERA,
  INITIAL_CORRIDOR_VIEW,
  MOBILE_CORRIDOR_ZOOM,
  selectCorridorView,
} from "./corridorView";
import "./mobile-corridor.css";

const MobileCorridorExplorer = lazy(() =>
  import("./MobileCorridorExplorer").then(({ MobileCorridorExplorer }) => ({
    default: MobileCorridorExplorer,
  })),
);
const MobileCardDetail = lazy(() =>
  import("./MobileCorridorDetails").then(({ MobileCardDetail }) => ({
    default: MobileCardDetail,
  })),
);
const MobileLaneDetail = lazy(() =>
  import("./MobileCorridorDetails").then(({ MobileLaneDetail }) => ({
    default: MobileLaneDetail,
  })),
);
type Companion =
  | { kind: "explore" }
  | { kind: "card"; id: string }
  | {
      kind: "lane";
      id: LaneId;
    }
  | null;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function MobileCorridor({ active = true }: { active?: boolean }) {
  const corridorAccess = useCorridorReadScope();
  const guide = useGuide();
  const [laneId, setLaneId] = useState<LaneId>(STORE.lanes[0].id);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [view, setView] = useState(INITIAL_CORRIDOR_VIEW);
  const zoomMaximum = MOBILE_CORRIDOR_ZOOM[view.mode];
  const [companion, setCompanion] = useState<Companion>(null);
  const [travel, setTravel] = useState(false);
  const [travelX, setTravelX] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const documentVisible = useDocumentVisible();
  const [gestureMode, setGestureMode] = useState<"move" | "orbit">("move");
  const [size, setSize] = useState({ width: 390, height: 420 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const gesture = useRef(createCorridorGesture());
  const suppressClickUntil = useRef(0);
  const presetMotion = useCorridorPresetMotion({
    camera,
    onChange: setCamera,
    enabled: active && documentVisible,
    reducedMotion,
  });
  useGuideScene(active, step => {
    if (step !== 'workflow') return;
    if (!corridorAccess.ok) { if (guide.request) guide.acknowledge(guide.request.id, 'unavailable'); return; }
    setCompanion(null);
    setTravel(false);
    setView(INITIAL_CORRIDOR_VIEW);
    setLaneId(STORE.lanes[0].id);
    const id = guide.request!.id;
    presetMotion.reset({ ...INITIAL_CAMERA, pitch: 48, yaw: -16 }, () => { if (guide.ownsRequest(id)) guide.acknowledge(id, 'ready'); });
    return presetMotion.cancel;
  });
  function setDirectCamera(
    next: SetStateAction<MobileCorridorCamera>,
    mode: typeof view.mode = view.mode,
  ) {
    presetMotion.cancel();
    setCamera((current) => {
      const candidate = typeof next === "function" ? next(current) : next;
      const reach = mode === "overview" ? Math.max(1, candidate.zoom) : 1;
      return {
        ...candidate,
        panX: clamp(candidate.panX, -size.width * reach, size.width * reach),
        panY: clamp(candidate.panY, -size.height * reach, size.height * reach),
      };
    });
  }

  const laneIndex = STORE.lanes.findIndex((lane) => lane.id === laneId);
  const lane = STORE.lanes[laneIndex];
  const projection = useMemo(
    () => selectCorridorView(STORE.lanes, STORE.laneCards, view, laneId),
    [view, laneId],
  );
  const laneCards = projection.cards;
  const selectedCard =
    companion?.kind === "card"
      ? (STORE.laneCards.find((card) => card.id === companion.id) ?? null)
      : null;
  const detailLane =
    companion?.kind === "lane"
      ? STORE.lanes.find((lane) => lane.id === companion.id)!
      : lane;
  // Direct finger tracking stays immediate; presets and Reset share a cancellable spring.
  const sceneControl = {
    ...DEFAULT_CONTROL,
    travel: true,
    showArrows: view.showArrows,
  };
  const stage = STAGES.find((entry) => entry.id === lane.stage)!;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [corridorAccess.ok]);

  useEffect(() => {
    function hidden() {
      if (document.hidden) resetGesture();
    }
    window.addEventListener("blur", resetGesture);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", resetGesture);
      document.removeEventListener("visibilitychange", hidden);
      resetGesture();
    };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    if (!active) resetGesture();
    const dialog = detailRef.current;
    if (!dialog) return;
    if (companion && active && !dialog.open) {
      resetGesture();
      dialog.showModal();
    }
    if ((!companion || !active) && dialog.open) dialog.close();
  }, [companion, active, corridorAccess.ok]);

  useEffect(() => {
    if (!travel || !active || !documentVisible || reducedMotion || companion)
      return;
    return startSceneLoop(
      (elapsed) =>
        setTravelX((previous) => (previous + elapsed * 0.08) % LANE_LENGTH_PX),
      {
        now: () => performance.now(),
        request: (callback) => requestAnimationFrame(callback),
        cancel: (id) => cancelAnimationFrame(id),
      },
    );
  }, [travel, active, documentVisible, reducedMotion, companion]);

  function selectCard(id: string) {
    setSelectedCardId(id);
    setCompanion({ kind: "card", id });
  }
  function closeCompanion() {
    setCompanion(null);
  }

  function changeLane(id: LaneId) {
    resetGesture();
    setLaneId(id);
    setView((current) => {
      const hidden = new Set(current.hidden);
      hidden.delete(id);
      return { ...current, mode: "lane", hidden };
    });
    setCompanion(null);
    setSelectedCardId(null);
    setDirectCamera(INITIAL_CAMERA);
    stepsRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function resetGesture() {
    const ids = gesture.current.reset();
    if (ids.length) suppressClickUntil.current = performance.now() + 250;
    for (const id of ids) {
      if (viewportRef.current?.hasPointerCapture(id))
        viewportRef.current.releasePointerCapture(id);
    }
  }

  function changeView(next: typeof view) {
    setView(next);
    const maximum = MOBILE_CORRIDOR_ZOOM[next.mode];
    if (next.mode !== view.mode) {
      setDirectCamera(
        (current) => ({ ...current, zoom: Math.min(current.zoom, maximum) }),
        next.mode,
      );
    }
  }

  function resetCamera() {
    resetGesture();
    presetMotion.reset(INITIAL_CAMERA);
    setTravel(false);
    setTravelX(0);
  }

  function chooseGestureMode(mode: "move" | "orbit") {
    resetGesture();
    setGestureMode(mode);
  }

  function zoomBy(amount: number) {
    setDirectCamera((previous) => ({
      ...previous,
      zoom: clamp(
        previous.zoom + amount,
        MOBILE_CORRIDOR_ZOOM.min,
        zoomMaximum,
      ),
    }));
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!active || (event.pointerType === "mouse" && event.button !== 0))
      return;
    presetMotion.cancel();
    setTravel(false);
    gesture.current.begin(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.buttons === 0) {
      pointerUp(event);
      return;
    }
    const delta = gesture.current.move(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!delta) return;
    const { dx, dy } = delta;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (delta.pinch) {
      setDirectCamera((current) => ({
        ...current,
        zoom: clamp(
          current.zoom * delta.zoomRatio,
          MOBILE_CORRIDOR_ZOOM.min,
          zoomMaximum,
        ),
        panX: current.panX + dx,
        panY: current.panY + dy,
      }));
    } else if (gestureMode === "orbit") {
      setDirectCamera((current) => ({
        ...current,
        ...orbitCorridor(current.pitch, current.yaw, dx, dy, 0.3),
      }));
    } else {
      setDirectCamera((current) => ({
        ...current,
        panX: current.panX + dx,
        panY: current.panY + dy,
      }));
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current.end(event.pointerId))
      suppressClickUntil.current = performance.now() + 250;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  // Compress only the lane's longitudinal axis. Upright card faces live in the
  // cross-lane/height plane, so they retain their proportions and source data.
  const wideCanvas = size.width > size.height * 1.3;
  const yawBase = view.mode === "overview" ? -32 : wideCanvas ? -38 : -60;
  const yaw = yawBase + camera.yaw;
  const fitScale = Math.min(
    (size.width - 36) / (wideCanvas ? 650 : 465),
    (size.height - (wideCanvas ? 92 : 48)) / (wideCanvas ? 345 : 425),
    1.55,
  );
  const overviewFit = Math.min(
    (size.width - 40) / (700 + projection.lanes.length * 80),
    (size.height - (wideCanvas ? 110 : 48)) /
      (420 + projection.lanes.length * 80),
  );
  const scale =
    Math.max(0.1, view.mode === "overview" ? overviewFit * 0.82 : fitScale) *
    camera.zoom;
  const travelOffset = travel ? LANE_LENGTH_PX / 2 - travelX : 0;
  const sceneTransform = `translate(-50%, -50%) translate(${camera.panX}px, ${camera.panY - 18}px) scale(${scale}) rotateX(${camera.pitch}deg) rotateZ(${yaw}deg) scale3d(0.26, 1, 1) translateX(${travelOffset}px)`;

  if (!corridorAccess.ok)
    return (
      <p className="p-6 text-sm text-[var(--sot-shell-muted)]" role="status">
        {corridorAccess.reason}
      </p>
    );

  return (
    <section
      className="mobile-corridor"
      aria-label="Workflow corridor"
      style={{ "--mobile-corridor-accent": lane.color } as CSSProperties}
    >
      <header className="mobile-corridor-heading">
        <div className="mobile-corridor-stages" aria-label="Workflow stage">
          {STAGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={
                view.mode === "overview"
                  ? view.stage === entry.id
                  : lane.stage === entry.id
              }
              onClick={() =>
                view.mode === "overview"
                  ? setView({
                      ...view,
                      stage: view.stage === entry.id ? "all" : entry.id,
                    })
                  : changeLane(
                      STORE.lanes.find((item) => item.stage === entry.id)!.id,
                    )
              }
            >
              <span style={{ background: entry.color }} />
              {entry.label}
            </button>
          ))}
        </div>
        <div className="mobile-corridor-heading-row">
          <div className="mobile-corridor-heading-copy">
            <p className="mobile-corridor-eyebrow">
              CORRIDOR {String(laneIndex + 1).padStart(2, "0")}{" "}
              <span>/ {String(STORE.lanes.length).padStart(2, "0")}</span>
            </p>
            <div className="mobile-corridor-picker">
              <h2>
                {view.mode === "overview" ? "Workflow overview" : lane.label}
              </h2>
              <ChevronDown size={16} aria-hidden="true" />
              <select
                value={laneId}
                aria-label="Choose a workflow lane"
                onChange={(event) => changeLane(event.target.value as LaneId)}
              >
                {STAGES.map((entry) => (
                  <optgroup key={entry.id} label={entry.label}>
                    {STORE.lanes
                      .filter((item) => item.stage === entry.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {String(item.order + 1).padStart(2, "0")} ·{" "}
                          {item.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <nav
            className="mobile-corridor-lane-nav"
            aria-label="Move between workflow lanes"
          >
            <button
              type="button"
              aria-label="Previous lane"
              disabled={laneIndex === 0}
              onClick={() => changeLane(STORE.lanes[laneIndex - 1].id)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              aria-label="Next lane"
              disabled={laneIndex === STORE.lanes.length - 1}
              onClick={() => changeLane(STORE.lanes[laneIndex + 1].id)}
            >
              <ChevronRight size={19} />
            </button>
          </nav>
        </div>
        <p className="mobile-corridor-description">
          {view.mode === "overview"
            ? `${projection.lanes.length} lanes · ${projection.cards.length} records. Tap a lane or explore its steps.`
            : lane.description}
        </p>
        <div className="mobile-corridor-toolbar">
          <button
            aria-pressed={view.mode === "overview"}
            onClick={() => {
              setView({
                ...view,
                mode: view.mode === "overview" ? "lane" : "overview",
              });
              resetCamera();
            }}
          >
            Overview
          </button>
          <button onClick={() => setCompanion({ kind: "lane", id: laneId })}>
            Lane details
          </button>
          <button onClick={() => setCompanion({ kind: "explore" })}>
            <SlidersHorizontal size={15} />
            Explore
          </button>
        </div>
        <div className="mobile-corridor-progress" aria-hidden="true">
          {STORE.lanes.map((item) => (
            <span
              key={item.id}
              data-active={item.id === laneId}
              style={{ background: item.color }}
            />
          ))}
        </div>
      </header>

      <div className="mobile-corridor-stage">
        <div
          className="mobile-corridor-canvas"
          ref={viewportRef}
          tabIndex={0}
          aria-label={`${lane.label}, interactive 3D corridor. Drag to ${gestureMode}, pinch to zoom. Use arrow keys to move, plus and minus to zoom, Home to reset. Steps are also available in the step list.`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onLostPointerCapture={(event) => {
            // Ignore a child's implicit touch capture transferring to this canvas.
            if (event.target === event.currentTarget) pointerUp(event);
          }}
          onPointerLeave={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId))
              pointerUp(event);
          }}
          onClickCapture={(event) => {
            if (performance.now() < suppressClickUntil.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onWheel={(event) =>
            setDirectCamera((current) => ({
              ...current,
              zoom: clamp(
                current.zoom - event.deltaY * 0.002,
                MOBILE_CORRIDOR_ZOOM.min,
                zoomMaximum,
              ),
            }))
          }
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") zoomBy(0.2);
            else if (event.key === "-") zoomBy(-0.2);
            else if (event.key === "Home") resetCamera();
            else if (event.key.startsWith("Arrow"))
              setDirectCamera((current) => ({
                ...current,
                panX:
                  current.panX +
                  (event.key === "ArrowRight"
                    ? 24
                    : event.key === "ArrowLeft"
                      ? -24
                      : 0),
                panY:
                  current.panY +
                  (event.key === "ArrowDown"
                    ? 24
                    : event.key === "ArrowUp"
                      ? -24
                      : 0),
              }));
            else return;
            event.preventDefault();
          }}
        >
          <div className="mobile-corridor-ground" aria-hidden="true" />
          <CorridorScene
            ctrl={sceneControl}
            sceneTransform={sceneTransform}
            visibleLanes={projection.lanes}
            visibleCards={laneCards}
            arrows={STORE.laneArrows}
            flags={STORE.laneFlags}
            surfaceLabels={STORE.laneSurfaceLabels}
            travelX={travel ? travelX : null}
            selectedCardId={selectedCardId}
            onCardClick={selectCard}
            onLaneClick={(id) => setCompanion({ kind: "lane", id })}
          />
          {!projection.cards.length && (
            <div className="mobile-corridor-empty">
              <p>No records match this view.</p>
              <button onClick={() => changeView(INITIAL_CORRIDOR_VIEW)}>
                Reset view filters
              </button>
            </div>
          )}
        </div>
        <div className="mobile-corridor-canvas-label" aria-hidden="true">
          <span className="mobile-corridor-stage-dot" />
          {view.mode === "overview" ? "ALL LANES" : stage.label}
          <span> / </span>
          {travel
            ? "TRAVEL"
            : view.mode === "overview"
              ? `${projection.lanes.length} VISIBLE`
              : lane.shortLabel}
        </div>
        <div className="mobile-corridor-direction" aria-hidden="true">
          <ArrowDownLeft size={13} /> INTAKE <span /> RELEASE{" "}
          <ArrowUpRight size={13} />
        </div>
        <div
          className="mobile-corridor-camera"
          aria-label="Corridor camera controls"
        >
          <div className="mobile-corridor-camera-modes">
            <button
              type="button"
              aria-label="Move"
              aria-pressed={gestureMode === "move"}
              onClick={() => chooseGestureMode("move")}
            >
              <Move size={17} />
              <span>Move</span>
            </button>
            <button
              type="button"
              aria-label="Orbit"
              aria-pressed={gestureMode === "orbit"}
              onClick={() => chooseGestureMode("orbit")}
            >
              <Orbit size={17} />
              <span>Orbit</span>
            </button>
          </div>
          <div className="mobile-corridor-camera-zoom">
            <button
              type="button"
              aria-label={
                travel ? "Stop corridor travel" : "Start corridor travel"
              }
              aria-pressed={travel}
              disabled={reducedMotion}
              title={
                reducedMotion
                  ? "Travel is paused for reduced motion"
                  : "Travel along the corridor"
              }
              onClick={() => {
                setTravel(!travel);
                setTravelX(0);
              }}
            >
              {travel ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              type="button"
              aria-label="Zoom out of corridor"
              disabled={camera.zoom <= MOBILE_CORRIDOR_ZOOM.min}
              onClick={() => zoomBy(-0.2)}
            >
              <ZoomOut size={18} />
            </button>
            <button
              type="button"
              aria-label="Zoom into corridor"
              disabled={camera.zoom >= zoomMaximum}
              onClick={() => zoomBy(0.2)}
            >
              <ZoomIn size={18} />
            </button>
            <button
              type="button"
              aria-label="Reset corridor camera"
              onClick={resetCamera}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        {gestureMode === "orbit" && (
          <div
            className="mobile-corridor-orbit-steps"
            role="group"
            aria-label="Turn and tilt corridor with buttons"
          >
            <span>Turn</span>
            <button
              type="button"
              aria-label="Rotate corridor left"
              onClick={() =>
                setDirectCamera((current) => ({
                  ...current,
                  yaw: current.yaw - 10,
                }))
              }
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Rotate corridor right"
              onClick={() =>
                setDirectCamera((current) => ({
                  ...current,
                  yaw: current.yaw + 10,
                }))
              }
            >
              <ChevronRight size={18} />
            </button>
            <span>Tilt</span>
            <button
              type="button"
              aria-label="Tilt corridor toward top view"
              disabled={camera.pitch <= CORRIDOR_PITCH.min}
              onClick={() =>
                setDirectCamera((current) => ({
                  ...current,
                  pitch: clampCorridorPitch(current.pitch - 10),
                }))
              }
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              aria-label="Tilt corridor toward side view"
              disabled={camera.pitch >= CORRIDOR_PITCH.max}
              onClick={() =>
                setDirectCamera((current) => ({
                  ...current,
                  pitch: clampCorridorPitch(current.pitch + 10),
                }))
              }
            >
              <ChevronDown size={18} />
            </button>
          </div>
        )}
        <p className="mobile-corridor-gesture-hint">
          Drag to {gestureMode} · pinch to zoom
        </p>
      </div>

      <div className="mobile-corridor-steps">
        <div className="mobile-corridor-steps-label">
          <span>Explore the steps</span>
          <span>
            {laneCards.length} records <ChevronRight size={12} />
          </span>
        </div>
        <div
          className="mobile-corridor-step-list"
          ref={stepsRef}
          aria-label={`Steps in ${lane.label}`}
        >
          {laneCards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className="mobile-corridor-step"
              aria-haspopup="dialog"
              onClick={() => selectCard(card.id)}
            >
              <span className="mobile-corridor-step-top">
                <span
                  className="mobile-corridor-card-swatch"
                  style={{ background: cardStyle(card.kind).bg }}
                />
                {cardStyle(card.kind).label}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </span>
              <strong>{card.label}</strong>
              <span className="mobile-corridor-step-open">
                View record <ArrowUpRight size={12} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {createPortal(
        <dialog
          ref={detailRef}
          className="mobile-corridor-detail"
          style={{ "--mobile-corridor-accent": lane.color } as CSSProperties}
          aria-labelledby="mobile-corridor-detail-title"
          onClose={closeCompanion}
          onCancel={closeCompanion}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCompanion();
          }}
        >
          {companion?.kind === "explore" && (
            <DeferredView label="corridor controls">
              <MobileCorridorExplorer
                view={view}
                onView={changeView}
                camera={camera}
                onCamera={setDirectCamera}
                onPreset={(preset) =>
                  presetMotion.select({ ...preset, yaw: preset.yaw - yawBase })
                }
                yawBase={yawBase}
                onLane={changeLane}
                onClose={closeCompanion}
              />
            </DeferredView>
          )}
          {companion?.kind === "lane" && (
            <DeferredView label="lane details">
              <MobileLaneDetail
                lane={detailLane}
                onSelect={selectCard}
                onClose={closeCompanion}
              />
            </DeferredView>
          )}
          {selectedCard && (
            <DeferredView label="workflow record">
              <MobileCardDetail
                card={selectedCard}
                lane={STORE.lanes.find(
                  (item) => item.id === selectedCard.laneId,
                )!}
                cards={STORE.laneCards.filter(
                  (item) => item.laneId === selectedCard.laneId,
                )}
                onClose={closeCompanion}
                onSelect={selectCard}
              />
            </DeferredView>
          )}
        </dialog>,
        document.body,
      )}
    </section>
  );
}
