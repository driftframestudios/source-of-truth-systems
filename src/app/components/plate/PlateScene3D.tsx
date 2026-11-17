// ============================================================
// 3D plate scene — flat (tilt / pan / zoom) and upright result stacks.
//
// Pressing "Sample history" winds the plate back a few degrees, then
// swings it onto its edge at an extreme yaw on an under-damped spring
// (a slight rubber-band overshoot) and settles it: clamps snap onto the
// corners, a light sweep crosses the face, and every well's results
// extrude outward as stacked discs. Hovering a disc drops a gossamer
// thread to the tray, where the result's record unfurls.
//
// 3D invariant: elements carrying preserve-3d never take opacity < 1,
// filter, overflow, clip-path or blend modes (scripts/check-3d-flattening).
// ============================================================

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { Layers3, RectangleVertical } from 'lucide-react';
import type { Well, WellResult } from '../../types';
import { wellIdOf } from '../../data/wellResults';
import { usePlateOverlay } from './plateOverlay';
import { ResultStack } from './ResultStack';
import { GossamerThread } from './GossamerThread';
import { ResultTray } from './ResultTray';
import type { PlateHistorySourceProps } from './PlateHistorySource';
import { plateFacts, platePosture } from './plateProjection';
import { WellHoverCard } from './WellPanels';
import { discPaint, discBackground } from './stackLens';
import { usePlateColors } from './usePlateColors';
import type { DiscPaint } from './stackLens';
import {
  COLS, DISC_R, FLAT_CAMERA, PLATE_H, PLATE_MARGIN, PLATE_THICKNESS, PLATE_W, ROWS, ROW_LABELS, TILE,
  clamp, compactFlatCamera, project, stackDepths, trayHeight, uprightCamera, wellCenter,
} from './plateGeometry';
import type { Camera } from './plateGeometry';
import type { PlateStackUi, StackFocus } from './plateState';
import { indexResultWells } from './plateState';
import './plate.css';
import { ownsSceneInput, useSceneDrag } from '../useSceneDrag';
import { createSceneTransition } from './sceneTransition';
import { useDocumentVisible } from '../useDocumentVisible';
import { usePlateTouch } from './usePlateTouch';
import { useProjectedCamera } from './useProjectedCamera';
import { PlateCameraControls } from './PlateCameraControls';

type Phase = 'flat' | 'rising' | 'locked' | 'lowering';
const CAMERA_KEYS = ['rx', 'ry', 'rz', 'zoom', 'panX', 'panY', 'rootX', 'rootY', 'persp'] as const;
type CameraKey = (typeof CAMERA_KEYS)[number];

// ζ ≈ 0.66 → ~6% overshoot: a slight rubber-band before the lock settles.
const LOCK_SPRING = { type: 'spring' as const, stiffness: 250, damping: 21, mass: 1 };
const RELEASE_SPRING = { type: 'spring' as const, stiffness: 200, damping: 24, mass: 1 };
const HOVER_INTENT_MS = 90;

function restDeltaFor(k: CameraKey): number {
  return k === 'zoom' ? 0.0008 : k === 'persp' || k === 'rootX' || k === 'rootY' || k === 'panX' || k === 'panY' ? 0.4 : 0.04;
}

export interface PlateScene3DProps {
  readonly presentation?: 'desktop' | 'compact';
  readonly active?: boolean;
  readonly wells: ReadonlyArray<Well>;
  readonly resultsByWell: ReadonlyMap<string, ReadonlyArray<WellResult>>;
  readonly ui: PlateStackUi;
  readonly onUiChange: (patch: Partial<PlateStackUi>) => void;
  readonly focus: StackFocus | null;
  readonly onFocusChange: (focus: StackFocus | null) => void;
  readonly selectedWell: Well | null;
  readonly onWellClick: (well: Well) => void;
  readonly historySource?: PlateHistorySourceProps;
  readonly historySourceFor?: (wellId: string | null) => PlateHistorySourceProps;
  readonly onHistoryReady?: (ready: boolean) => void;
}

export function PlateScene3D({
  wells, resultsByWell, ui, onUiChange, focus, onFocusChange, selectedWell, onWellClick, historySource, historySourceFor, presentation = 'desktop', active = true, onHistoryReady,
}: PlateScene3DProps) {
  const { theme, status: STATUS_COLOR } = usePlateColors();
  const reduced = useReducedMotion() ?? false;
  const compact = presentation === 'compact';
  const visible = useDocumentVisible();
  const engaged = active && visible;
  const overlay = usePlateOverlay();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 720 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth && el.clientHeight) setSize({ w: el.clientWidth, h: el.clientHeight }); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- camera ------------------------------------------------------------
  const rx = useMotionValue(FLAT_CAMERA.rx);
  const ry = useMotionValue(FLAT_CAMERA.ry);
  const rz = useMotionValue(FLAT_CAMERA.rz);
  const zoom = useMotionValue(FLAT_CAMERA.zoom);
  const panX = useMotionValue(FLAT_CAMERA.panX);
  const panY = useMotionValue(FLAT_CAMERA.panY);
  const rootX = useMotionValue(FLAT_CAMERA.rootX);
  const rootY = useMotionValue(FLAT_CAMERA.rootY);
  const persp = useMotionValue(FLAT_CAMERA.persp);
  const mv = useMemo<Record<CameraKey, MotionValue<number>>>(
    () => ({ rx, ry, rz, zoom, panX, panY, rootX, rootY, persp }),
    [rx, ry, rz, zoom, panX, panY, rootX, rootY, persp],
  );
  const plateTransform = useMotionTemplate`translate3d(${panX}px, ${panY}px, 0px) scale3d(${zoom}, ${zoom}, ${zoom}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  const perspective = useMotionTemplate`${persp}px`;

  const [phase, setPhaseState] = useState<Phase>('flat');
  const phaseRef = useRef<Phase>('flat');
  const setPhase = useCallback((p: Phase) => { phaseRef.current = p; setPhaseState(p); }, []);
  const [extruded, setExtruded] = useState(false);
  const savedFlat = useRef<Camera>(FLAT_CAMERA);
  const transition = useMemo(() => createSceneTransition({
    delay: (callback, ms) => window.setTimeout(callback, ms),
    clearDelay: (id) => window.clearTimeout(id),
    frame: (callback) => requestAnimationFrame(callback),
    clearFrame: (id) => cancelAnimationFrame(id),
  }), []);
  const snapshot = useCallback((): Camera => ({
    rx: rx.get(), ry: ry.get(), rz: rz.get(), zoom: zoom.get(), panX: panX.get(), panY: panY.get(),
    rootX: rootX.get(), rootY: rootY.get(), persp: persp.get(),
  }), [rx, ry, rz, zoom, panX, panY, rootX, rootY, persp]);
  const jumpTo = useCallback((cam: Partial<Camera>) => {
    for (const k of Object.keys(cam) as CameraKey[]) mv[k].jump(cam[k]!);
  }, [mv]);
  const tweenTo = useCallback((cam: Partial<Camera>, options: Record<string, unknown>): Promise<void> => {
    const ctrls = (Object.keys(cam) as CameraKey[]).map((k) =>
      animate(mv[k], cam[k]!, options.type === 'spring' ? { ...options, restDelta: restDeltaFor(k), restSpeed: restDeltaFor(k) * 10 } : options));
    return new Promise<void>((resolve) => {
      const finish = () => { forget(); resolve(); };
      const forget = transition.own(() => { ctrls.forEach((c) => c.stop()); finish(); });
      Promise.all(ctrls.map((c) => new Promise<void>((done) => { c.then(() => done(), () => done()); }))).then(finish);
    });
  }, [mv, transition]);

  const historyReach = ui.spread === 'spacious' ? 340 : 240;
  const historyCamera = useCallback(() => uprightCamera(sizeRef.current.w, sizeRef.current.h, compact, historyReach), [compact, historyReach]);
  const historyFrame = useRef<string | null>(null);

  const enterUpright = useCallback(async () => {
    const t = transition.begin();
    historyFrame.current = null;
    if (phaseRef.current === 'flat') savedFlat.current = snapshot();
    setPhase('rising');
    setExtruded(false);
    const target = historyCamera();
    if (reduced) {
      jumpTo(target);
      setPhase('locked');
      setExtruded(true);
      return;
    }
    // Wind-up: lean back and counter-yaw a few degrees before the swing.
    await tweenTo({ rx: rx.get() + 6, ry: ry.get() - 6, zoom: zoom.get() * 0.965 }, { duration: 0.13, ease: [0.4, 0, 0.6, 1] });
    if (!transition.current(t)) return;
    await tweenTo(target, LOCK_SPRING);
    if (!transition.current(t)) return;
    setPhase('locked');
    transition.frame(() => { if (transition.current(t)) setExtruded(true); });
  }, [historyCamera, jumpTo, reduced, rx, ry, setPhase, snapshot, transition, tweenTo, zoom]);

  const exitUpright = useCallback(async () => {
    const t = transition.begin();
    setPhase('lowering');
    setExtruded(false);
    if (reduced) {
      jumpTo(savedFlat.current);
      setPhase('flat');
      return;
    }
    await transition.delay(200);
    if (!transition.current(t)) return;
    await tweenTo(savedFlat.current, RELEASE_SPRING);
    if (!transition.current(t)) return;
    setPhase('flat');
  }, [jumpTo, reduced, setPhase, transition, tweenTo]);

  useEffect(() => {
    if (!engaged) { transition.cancel(); return; }
    const p = phaseRef.current;
    if (ui.upright && p !== 'locked') void enterUpright();
    if (!ui.upright && p !== 'flat') void exitUpright();
  }, [engaged, ui.upright, enterUpright, exitUpright, transition]);

  const compactFrame = useRef('');
  // Fit after the spring entrance as well: a newly mounted mobile scene can
  // finish measuring while that entrance is already running.
  useEffect(() => {
    if (!engaged) return;
    const frame = `${size.w}:${size.h}`;
    if (compact && compactFrame.current !== frame) {
      compactFrame.current = frame;
      const target = compactFlatCamera(size.w);
      savedFlat.current = target;
      if (phaseRef.current === 'flat') jumpTo(target);
    }
    if (phaseRef.current !== 'locked') return;
    const historyBounds = `${frame}:${compact}:${historyReach}`;
    if (historyFrame.current === historyBounds) return;
    historyFrame.current = historyBounds;
    transition.cancel();
    setExtruded(true);
    if (reduced) jumpTo(historyCamera());
    else void tweenTo(historyCamera(), { type: 'spring', stiffness: 320, damping: 32 });
  }, [compact, engaged, phase, reduced, size.w, size.h, historyReach, historyCamera, jumpTo, transition, tweenTo]);

  useEffect(() => () => transition.cancel(), [transition]);

  // ---- derived result data -------------------------------------------------
  const stacks = useMemo(() => {
    const m = new Map<string, ReadonlyArray<WellResult>>();
    for (const [wid, list] of resultsByWell) m.set(wid, list.map(overlay.apply));
    return m;
  }, [resultsByWell, overlay.apply]);

  const facts = useMemo(() => plateFacts(stacks, overlay.athena), [stacks, overlay.athena]);

  const paints = useMemo(() => {
    const m = new Map<string, ReadonlyArray<DiscPaint>>();
    for (const [wid, list] of stacks) m.set(wid, list.map((r) => discPaint(r, ui.lens, facts.get(r.id) ?? { athena: 'pending' }, theme.mode)));
    return m;
  }, [stacks, facts, ui.lens, theme.mode]);

  const depths = useMemo(() => {
    const m = new Map<string, ReadonlyArray<number>>();
    for (const [wid, list] of stacks) m.set(wid, stackDepths(list, ui.spacing, ui.spread === 'spacious' ? 1.4 : 1));
    return m;
  }, [stacks, ui.spacing, ui.spread]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const [wid, list] of stacks) m.set(wid, list.length);
    return m;
  }, [stacks]);

  const stats = useMemo(() => platePosture(stacks, facts), [stacks, facts]);

  const wellById = useMemo(() => {
    const m = new Map<string, Well>();
    for (const w of wells) m.set(wellIdOf(w.row, w.col), w);
    return m;
  }, [wells]);

  const resultWells = useMemo(() => indexResultWells(stacks), [stacks]);

  // ---- focus ---------------------------------------------------------------
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const focusWellId = focus ? resultWells.get(focus.resultId) ?? null : null;
  const focusStack = focusWellId ? stacks.get(focusWellId) ?? [] : [];
  const focusResult = focus ? focusStack.find((r) => r.id === focus.resultId) ?? null : null;
  const focusWell = focusWellId ? wellById.get(focusWellId) ?? null : null;

  const hoverTimer = useRef<number | null>(null);
  const cancelHover = () => {
    if (hoverTimer.current != null) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  };
  const scheduleFocus = (resultId: string) => {
    if (focusRef.current?.resultId === resultId) { cancelHover(); return; }
    cancelHover();
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      if (!focusRef.current?.pinned) onFocusChange({ resultId, pinned: false });
    }, HOVER_INTENT_MS);
  };
  useEffect(() => cancelHover, []);
  useEffect(() => { if (!engaged) cancelHover(); }, [engaged]);

  const selectResult = useCallback((resultId: string, pinned: boolean) => {
    onFocusChange({ resultId, pinned });
    const w = wellById.get(resultWells.get(resultId) ?? '');
    if (w) onWellClick(w);
  }, [onFocusChange, onWellClick, wellById, resultWells]);

  const walkStack = useCallback((dir: 1 | -1) => {
    const f = focusRef.current;
    if (!f) return;
    const list = stacks.get(resultWells.get(f.resultId) ?? '') ?? [];
    const i = list.findIndex((r) => r.id === f.resultId);
    const next = list[i + dir];
    if (!next) return;
    onFocusChange({ resultId: next.id, pinned: f.pinned });
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(next.id)}"]`);
    if (el && document.activeElement?.hasAttribute('data-result-id')) el.focus({ preventScroll: true });
  }, [onFocusChange, stacks, resultWells]);

  // At this extreme angle a near column's stack can sit in front of its
  // neighbour's seated disc, so every disc is also reachable from the keyboard.
  const moveWell = useCallback((dRow: number, dCol: number) => {
    const f = focusRef.current;
    if (!f) return;
    const from = wellById.get(resultWells.get(f.resultId) ?? '');
    if (!from) return;
    const row = clamp(from.row + dRow, 0, ROWS - 1);
    const col = clamp(from.col + dCol, 0, COLS - 1);
    const targetId = wellIdOf(row, col);
    const target = stacks.get(targetId);
    if (!target?.length || (row === from.row && col === from.col)) return;
    const seq = Math.min(stacks.get(wellIdOf(from.row, from.col))?.find((r) => r.id === f.resultId)?.seq ?? 0, target.length - 1);
    onFocusChange({ resultId: target[seq].id, pinned: f.pinned });
    const w = wellById.get(targetId);
    if (w) onWellClick(w);
  }, [onFocusChange, onWellClick, stacks, wellById, resultWells]);

  // Global keys while the plate scene is mounted: U toggles upright, Esc unwinds,
  // ←/→ walk a stack, ↑/↓ change row, Shift+←/→ change column.
  useEffect(() => {
    if (!engaged) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        onUiChange({ upright: !ui.upright });
      } else if (e.key === 'Escape') {
        const f = focusRef.current;
        if (f?.pinned) onFocusChange({ ...f, pinned: false });
        else if (f) onFocusChange(null);
        else if (ui.upright) onUiChange({ upright: false });
      } else if (e.key.startsWith('Arrow') && focusRef.current && phaseRef.current === 'locked') {
        e.preventDefault();
        const horizontal = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (horizontal && e.shiftKey) moveWell(0, horizontal);
        else if (horizontal) walkStack(horizontal);
        else moveWell(e.key === 'ArrowDown' ? 1 : -1, 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engaged, moveWell, onFocusChange, onUiChange, ui.upright, walkStack]);

  // ---- pointer: flat-mode orbit, hover card, disc hover / click -------------
  const [hoverWellId, setHoverWellId] = useState<string | null>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const placeHoverCard = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const el = hoverCardRef.current;
    if (!rect || !el) return;
    const x = Math.min(clientX - rect.left + 16, rect.width - 250);
    const y = Math.min(clientY - rect.top + 12, rect.height - 190);
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const lastPointer = useRef({ x: 0, y: 0 });
  // The card mounts on the render after hover starts; place it before paint.
  useLayoutEffect(() => {
    if (hoverWellId != null) placeHoverCard(lastPointer.current.x, lastPointer.current.y);
  });

  const cameraReady = phase === 'flat' || phase === 'locked';
  useEffect(() => { onHistoryReady?.(engaged && ui.upright && phase === 'locked'); }, [engaged, ui.upright, phase, onHistoryReady]);
  const orbit = (dx: number, dy: number) => {
    cancelHover();
    if (phaseRef.current === 'locked') {
      ry.jump(clamp(ry.get() + dx * .3, 25, 82));
      rx.jump(clamp(rx.get() - dy * .3, -35, 35));
    } else {
      rz.jump(rz.get() + dx * .4);
      rx.jump(clamp(rx.get() - dy * .4, 10, 85));
    }
  };
  const drag = useSceneDrag({
    enabled: engaged && cameraReady,
    threshold: 3,
    onMove: ({ dx, dy, mode }) => {
      setHoverWellId(null);
      if (mode === 'orbit') {
        orbit(dx, dy);
      } else {
        panX.jump(panX.get() + dx);
        panY.jump(panY.get() + dy);
      }
    },
  });
  const touch = usePlateTouch(compact && engaged && cameraReady, ({ dx, dy, zoomRatio, pinch }) => {
    setHoverWellId(null);
    if (pinch) {
      zoom.jump(clamp(zoom.get() * zoomRatio, .3, 2));
      panX.jump(panX.get() + dx);
      panY.jump(panY.get() + dy);
    } else {
      orbit(dx, dy);
    }
  });
  const touchEvent = (event: ReactPointerEvent<HTMLElement>) => compact && event.pointerType === 'touch';
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastPointer.current = { x: e.clientX, y: e.clientY };
    if (hoverWellId != null) placeHoverCard(e.clientX, e.clientY);
    if (touchEvent(e)) touch.onPointerMove(e); else drag.onPointerMove(e);
  };
  const onPointerOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!engaged || drag.isDragging() || (compact && e.pointerType === 'touch')) return;
    const t = e.target as HTMLElement;
    if (phaseRef.current === 'locked') {
      const disc = t.closest<HTMLElement>('[data-result-id]');
      if (disc && !focusRef.current?.pinned) scheduleFocus(disc.dataset.resultId!);
      return;
    }
    if (phaseRef.current === 'flat' && !drag.isDragging()) {
      const w = t.closest<HTMLElement>('[data-well-idx]');
      const idx = w ? Number(w.dataset.wellIdx) : null;
      const well = idx == null ? undefined : wells[idx];
      const id = well ? wellIdOf(well.row, well.col) : null;
      setHoverWellId((previous) => previous === id ? previous : id);
      if (idx != null) requestAnimationFrame(() => placeHoverCard(lastPointer.current.x || e.clientX, lastPointer.current.y || e.clientY));
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onPointerOut = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const rel = e.relatedTarget as Node | null;
    const disc = t.closest('[data-result-id]');
    if (disc && !(rel && disc.contains(rel))) cancelHover();
    const w = t.closest('[data-well-idx]');
    if (w && !(rel && w.contains(rel))) setHoverWellId(null);
  };
  const onClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (phaseRef.current === 'locked') {
      const disc = t.closest<HTMLElement>('[data-result-id]');
      if (disc) {
        cancelHover();
        const id = disc.dataset.resultId!;
        const f = focusRef.current;
        selectResult(id, !(f?.resultId === id && f.pinned));
        return;
      }
      const wEl = t.closest<HTMLElement>('[data-well-idx]');
      if (wEl) {
        const w = wells[Number(wEl.dataset.wellIdx)];
        if (!w) return;
        const list = stacks.get(wellIdOf(w.row, w.col)) ?? [];
        if (list.length) selectResult(list[list.length - 1].id, true);
        else onWellClick(w);
      }
      return;
    }
    if (phaseRef.current === 'flat') {
      const wEl = t.closest<HTMLElement>('[data-well-idx]');
      const well = wEl ? wells[Number(wEl.dataset.wellIdx)] : undefined;
      if (well) onWellClick(well);
    }
  };
  const onFocusCapture = (e: React.FocusEvent) => {
    const disc = (e.target as HTMLElement).closest<HTMLElement>('[data-result-id]');
    if (disc && phaseRef.current === 'locked' && !focusRef.current?.pinned) onFocusChange({ resultId: disc.dataset.resultId!, pinned: false });
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const disc = (e.target as HTMLElement).closest<HTMLElement>('[data-result-id]');
    if (!disc || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const id = disc.dataset.resultId!;
    const f = focusRef.current;
    selectResult(id, !(f?.resultId === id && f.pinned));
  };
  // Wheel zooms the scene. Result tabs and arrow keys retain explicit history navigation.
  const onWheel = (e: React.WheelEvent) => {
    if (ownsSceneInput(e.target) || !cameraReady) return;
    zoom.jump(clamp(zoom.get() - e.deltaY * 0.001, 0.3, 2));
  };

  // Labels and the record thread use the current camera, including manual exploration.
  const locked = phase === 'locked';
  const lockCam = useProjectedCamera(mv, snapshot, engaged && locked);
  const fitCamera = () => phaseRef.current === 'locked' ? historyCamera() : compact ? compactFlatCamera(size.w) : FLAT_CAMERA;
  const framePlate = () => { transition.cancel(); void tweenTo(fitCamera(), reduced ? { duration: 0 } : RELEASE_SPRING); };
  const centerSample = () => {
    const well = focusWell ?? selectedWell;
    if (!well) return;
    transition.cancel();
    const base = fitCamera();
    const target = { ...base, zoom: Math.min(base.zoom * 1.35, 2) };
    const { x, y } = wellCenter(well.row, well.col);
    const z = locked && focusResult ? depths.get(focusResult.wellId)?.[focusResult.seq] ?? 0 : 0;
    const point = project(target, x, y, z, size.w, size.h);
    const availableBottom = locked && !compact ? size.h - trayHeight(size.h) - 65 : size.h - 70;
    void tweenTo({ ...target, rootX: target.rootX + size.w / 2 - point.x, rootY: target.rootY + (46 + availableBottom) / 2 - point.y }, reduced ? { duration: 0 } : RELEASE_SPRING);
  };
  const tray = useMemo(() => {
    if (compact) return { left: 12, top: size.h - 2, width: size.w - 24, height: 0 };
    const h = trayHeight(size.h);
    return { left: 12, top: size.h - h - 10, width: Math.max(320, size.w - 24), height: h };
  }, [size.w, size.h, compact]);

  const focusGeometry = useMemo(() => {
    if (!locked || !focusResult || !focusWell) return null;
    const { x, y } = wellCenter(focusWell.row, focusWell.col);
    const zs = depths.get(focusResult.wellId) ?? [];
    const z = zs[focusResult.seq] ?? 0;
    const bottom = project(lockCam, x, y + DISC_R, z, size.w, size.h);
    const labels = focusStack.map((r, i) => {
      const p = project(lockCam, x, y - DISC_R - 3, zs[i] ?? 0, size.w, size.h);
      return { id: r.id, label: i === 0 ? `${r.wellId} · ${r.label}` : r.label, x: p.x, y: p.y, focused: r.id === focusResult.id, color: STATUS_COLOR[r.status] };
    });
    return {
      from: { x: bottom.x, y: bottom.y + 2 },
      to: { x: clamp(bottom.x, tray.left + 30, tray.left + tray.width - 30), y: tray.top },
      labels,
    };
  }, [locked, focusResult, focusWell, focusStack, depths, lockCam, size.w, size.h, tray, STATUS_COLOR]);

  const tipBadges = useMemo(() => {
    if (!locked) return [];
    const out: Array<{ wellId: string; x: number; y: number; n: number }> = [];
    for (const [wid, list] of stacks) {
      // Tall stacks always get a tip badge; pairs only when the filter asks for them.
      if (list.length < (ui.onlyMulti ? 2 : 3) || wid === focusWellId) continue;
      const w = wellById.get(wid);
      if (!w) continue;
      const zs = depths.get(wid) ?? [];
      const { x, y } = wellCenter(w.row, w.col);
      const p = project(lockCam, x, y - DISC_R, zs[zs.length - 1] ?? 0, size.w, size.h);
      out.push({ wellId: wid, x: p.x, y: p.y, n: list.length });
    }
    return out;
  }, [locked, stacks, focusWellId, wellById, depths, lockCam, size.w, size.h, ui.onlyMulti]);

  const hoverWell = hoverWellId ? wellById.get(hoverWellId) : null;
  const selectedIdx = selectedWell ? wells.findIndex((w) => w.row === selectedWell.row && w.col === selectedWell.col) : -1;
  const uprightish = phase === 'rising' || phase === 'locked';
  const showStacks = phase === 'locked' || phase === 'lowering';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 select-none${compact ? " plate-scene-compact" : ""}`}
      data-plate-phase={phase}
      style={{ cursor: cameraReady ? (drag.mode ? (drag.mode === 'pan' ? 'move' : 'grabbing') : 'grab') : 'default', touchAction: compact && cameraReady ? 'none' : undefined }}
      onPointerDown={(event) => { touch.preparePointer(); if (touchEvent(event)) touch.onPointerDown(event); else drag.onPointerDown(event); }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => touchEvent(event) ? touch.onPointerUp(event) : drag.onPointerUp(event)}
      onPointerCancel={(event) => touchEvent(event) ? touch.onPointerCancel(event) : drag.onPointerCancel(event)}
      onLostPointerCapture={(event) => touchEvent(event) ? touch.onLostPointerCapture(event) : drag.onLostPointerCapture(event)}
      onPointerLeave={drag.onPointerLeave}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClickCapture={(event) => { touch.onClickCapture(event); drag.onClickCapture(event); }}
      onClick={onClick}
      onFocusCapture={onFocusCapture}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onContextMenu={(e) => { if (cameraReady) e.preventDefault(); }}
    >
      {/* ---------------------------------------------------------------- 3D */}
      <motion.div
        className="absolute left-1/2 top-1/2"
        style={{ x: rootX, y: rootY, perspective, perspectiveOrigin: '0px 0px' }}
      >
        <motion.div style={{ transform: plateTransform, transformStyle: 'preserve-3d' }}>
          <PlateBody phase={phase} />

          <WellsLayer wells={wells} uprightish={uprightish} selectedIdx={selectedIdx} counts={counts} paints={paints} />

          {showStacks && wells.map((w) => {
            const wid = wellIdOf(w.row, w.col);
            const list = stacks.get(wid);
            if (!list || list.length === 0) return null;
            const { x, y } = wellCenter(w.row, w.col);
            return (
              <ResultStack
                key={wid}
                wellId={wid}
                x={x}
                y={y}
                results={list}
                depths={depths.get(wid) ?? []}
                paints={paints.get(wid) ?? []}
                extruded={extruded}
                focusedId={focus && focusWellId === wid ? focus.resultId : null}
                pinned={focusWellId === wid && !!focus?.pinned}
                dimmed={ui.onlyMulti && list.length < 2}
                interactive={locked}
                stagger={w.col * 24 + w.row * 9}
                instant={reduced}
              />
            );
          })}
        </motion.div>
      </motion.div>

      {/* ------------------------------------------------------------- HUD */}
      {phase === 'flat' && !compact && (
        <div className="absolute top-3 left-3 z-10 bg-[var(--sot-shell-background)]/85 border border-[var(--sot-shell-border)] rounded px-2 py-1 text-[9px] font-mono text-[var(--sot-shell-muted)]">
          drag · rotate · shift+drag · pan · wheel · zoom · <span className="text-teal-300">U</span> · sample history
        </div>
      )}

      <AnimatePresence>
        {locked && (
          <motion.div
            key="lock-hud"
            className="plate-history-badge"
            style={{ background: theme.shell.surface, borderColor: theme.shell.strongBorder, boxShadow: '0 0 24px rgba(45,212,191,0.18)' }}
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <Layers3 size={11} className="text-teal-300" />
            <span className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-teal-200">Timeline view</span>
            {!compact && <span className="plate-history-badge__hint">Esc releases</span>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="plate-view-switch absolute top-3 right-3 z-30 flex gap-1.5" data-no-drag>
        <button
          onClick={() => onUiChange({ upright: !ui.upright })}
          aria-pressed={ui.upright}
          title={compact ? "Switch between the plate overview and sample history" : "Switch between the plate overview and sample history (U)"}
          className="group flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border transition-colors"
          style={ui.upright
            ? { background: theme.mode === 'dark' ? '#2dd4bf' : theme.shell.accent, color: theme.shell.onAccent, borderColor: theme.shell.accent, boxShadow: '0 0 18px rgba(45,212,191,0.35)' }
            : { background: theme.shell.surface, color: theme.shell.selectedText, borderColor: theme.shell.strongBorder }}
        >
          {ui.upright ? <Layers3 size={11} /> : <RectangleVertical size={11} />}
          {ui.upright ? 'Plate overview' : 'Sample history'}
          {!compact && <span className="text-[8px] px-1 rounded" style={{ background: ui.upright ? 'rgba(6,43,39,0.2)' : 'rgba(45,212,191,0.12)' }}>U</span>}
        </button>
      </div>

      {cameraReady && <PlateCameraControls compact={compact} bottom={locked && !compact ? trayHeight(size.h) + 20 : 12}
        onFit={framePlate} onCenter={centerSample} canCenter={!!(focusWell ?? selectedWell)}
        onZoom={(direction) => zoom.jump(clamp(zoom.get() + direction * .1, .3, 2))}
        onOrbit={(direction) => orbit(direction * 25, 0)}
        onTilt={() => { if (locked) rx.jump(rx.get() >= 25 ? -25 : rx.get() + 10); else rx.jump(rx.get() >= 75 ? 25 : rx.get() + 10); }}
      />}

      {/* Flat-mode sample hover card. */}
      {phase === 'flat' && !compact && hoverWell && !drag.mode && (
        <div ref={hoverCardRef} className="absolute left-0 top-0 z-30 pointer-events-none" style={{ transform: 'translate(-9999px, -9999px)' }}>
          <WellHoverCard well={hoverWell} results={stacks.get(wellIdOf(hoverWell.row, hoverWell.col)) ?? []} />
        </div>
      )}

      {/* ------------------------------------------------------- upright overlays */}
      {locked && extruded && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 12 }} aria-hidden>
          {tipBadges.map((b) => (
            <span
              key={b.wellId}
              className="absolute flex items-center gap-1 text-[8px] font-mono pl-1 pr-1.5 py-px rounded-full border"
              style={{ left: b.x + 4, top: b.y - 16, color: theme.shell.text, background: theme.shell.surface, borderColor: theme.shell.border }}
            >
              <span className="text-[var(--sot-shell-secondary)]">{b.wellId}</span>
              <span className="text-[var(--sot-shell-selected-text)]">×{b.n}</span>
            </span>
          ))}
          {focusGeometry?.labels.map((l) => (
            <span
              key={l.id}
              className="absolute text-[8.5px] font-mono whitespace-nowrap origin-bottom-left"
              style={{
                left: l.x,
                top: l.y - 12,
                transform: 'rotate(-52deg)',
                color: l.focused ? theme.shell.text : l.color,
                textShadow: theme.mode === 'light' ? '0 1px 3px white' : '0 1px 3px rgba(0,0,0,0.9)',
                fontWeight: l.focused ? 600 : 400,
              }}
            >
              {l.label}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {locked && focusGeometry && focusResult && (
          <motion.div key={focusResult.id} className="absolute inset-0 pointer-events-none" style={{ zIndex: 22 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
            <GossamerThread from={focusGeometry.from} to={focusGeometry.to} color={STATUS_COLOR[focusResult.status]} instant={reduced} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ui.upright && !compact && (
          <ResultTray
            key="tray"
            geometry={tray}
            landingX={focusGeometry?.to.x ?? tray.left + tray.width / 2}
            result={focusResult}
            stack={focusStack}
            well={focusWell}
            pinned={!!focus?.pinned}
            instant={reduced}
            lens={ui.lens}
            stats={stats}
            historySource={historySourceFor ? historySourceFor(focusWellId ?? historySource?.wellId ?? null) : historySource && (focusWellId && focusWellId !== historySource.wellId
              ? { wellId: focusWellId, phase: 'idle', retry: historySource.retry }
              : historySource)}
            onSelect={(id) => selectResult(id, focus?.pinned ?? false)}
            onTogglePin={() => focus && onFocusChange({ ...focus, pinned: !focus.pinned })}
            onClose={() => onFocusChange(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Plate body — slab, skirts, rim labels, lock clamps and the lock sweep
// =============================================================================

const PlateBody = memo(function PlateBody({ phase }: { phase: Phase }) {
  const { theme } = usePlateColors();
  const locked = phase === 'locked';
  const W = PLATE_W + PLATE_MARGIN * 2;
  const H = PLATE_H + PLATE_MARGIN * 2;
  const T = PLATE_THICKNESS;
  const skirt: CSSProperties = { position: 'absolute', background: theme.mode === 'dark' ? 'linear-gradient(180deg, #161d2c, #0c111b)' : `linear-gradient(180deg, ${theme.scene.plateEdge}, ${theme.scene.plate})`, border: `1px solid ${theme.scene.plateEdge}` };
  return (
    <>
      <div
        className={locked ? 'plate-snap' : undefined}
        style={{
          position: 'absolute', left: -W / 2, top: -H / 2, width: W, height: H,
          backgroundColor: theme.mode === 'dark' ? '#1a1f2e' : theme.scene.plate, border: `2px solid ${theme.scene.plateEdge}`, borderRadius: 6,
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.4)',
        }}
      />
      {/* skirts — the plate's thickness, hanging behind the face */}
      <div aria-hidden style={{ ...skirt, left: -W / 2, top: H / 2, width: W, height: T, transformOrigin: '50% 0', transform: 'rotateX(-90deg)' }} />
      <div aria-hidden style={{ ...skirt, left: -W / 2, top: -H / 2 - T, width: W, height: T, transformOrigin: '50% 100%', transform: 'rotateX(90deg)' }} />
      <div aria-hidden style={{ ...skirt, left: -W / 2 - T, top: -H / 2, width: T, height: H, transformOrigin: '100% 50%', transform: 'rotateY(-90deg)' }} />
      <div aria-hidden style={{ ...skirt, left: W / 2, top: -H / 2, width: T, height: H, transformOrigin: '0 50%', transform: 'rotateY(90deg)' }} />

      {Array.from({ length: COLS }).map((_, c) => (
        <div key={`col-${c}`} style={{
          position: 'absolute', left: c * TILE - PLATE_W / 2 + TILE / 2 - 5, top: -PLATE_H / 2 - 16,
          fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: theme.scene.label,
        }}>{c + 1}</div>
      ))}
      {Array.from({ length: ROWS }).map((_, r) => (
        <div key={`row-${r}`} style={{
          position: 'absolute', left: -PLATE_W / 2 - 18, top: r * TILE - PLATE_H / 2 + TILE / 2 - 5,
          fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: theme.scene.label,
        }}>{ROW_LABELS[r]}</div>
      ))}

      {/* lock clamps — fly in from outside the corners and snap on */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => {
        const arm = 24;
        const cx = sx * (W / 2 + 7);
        const cy = sy * (H / 2 + 7);
        const edge = `2px solid ${theme.scene.alternateParticle}`;
        return (
          <div
            key={`${sx}${sy}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: sx < 0 ? cx : cx - arm,
              top: sy < 0 ? cy : cy - arm,
              width: arm,
              height: arm,
              borderTop: sy < 0 ? edge : undefined,
              borderBottom: sy > 0 ? edge : undefined,
              borderLeft: sx < 0 ? edge : undefined,
              borderRight: sx > 0 ? edge : undefined,
              borderRadius: 3,
              transform: `translateZ(2px) translate(${locked ? 0 : sx * 22}px, ${locked ? 0 : sy * 22}px)`,
              opacity: locked ? 1 : 0,
              boxShadow: locked ? '0 0 10px rgba(45,212,191,0.45)' : 'none',
              transition: 'transform 420ms cubic-bezier(0.34,1.56,0.64,1), opacity 160ms ease-out',
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {locked && (
        <div
          aria-hidden
          className="plate-sweep"
          style={{
            position: 'absolute', left: -W / 2, top: -H / 2, width: 64, height: H,
            background: 'linear-gradient(90deg, rgba(45,212,191,0), rgba(94,234,212,0.42), rgba(45,212,191,0))',
            pointerEvents: 'none',
            ['--sweep' as string]: `${W - 64}px`,
          }}
        />
      )}
    </>
  );
});

// =============================================================================
// Wells — latest-result lens paints when flat, sockets when upright
// =============================================================================

const WellsLayer = memo(function WellsLayer({
  wells, uprightish, selectedIdx, counts, paints,
}: {
  wells: ReadonlyArray<Well>;
  uprightish: boolean;
  selectedIdx: number;
  counts: ReadonlyMap<string, number>;
  paints: ReadonlyMap<string, ReadonlyArray<DiscPaint>>;
}) {
  const { theme } = usePlateColors();
  return (
    <>
      {wells.map((w, i) => {
        const { x, y } = wellCenter(w.row, w.col);
        const h = uprightish ? 1 : w.role === 'empty' ? 2 : 8;
        const isSelected = i === selectedIdx;
        const rescinded = w.consentStatus === 'rescinded';
        const pending = w.consentStatus === 'pending';
        const n = counts.get(wellIdOf(w.row, w.col)) ?? 0;
        const historyPaints = paints.get(wellIdOf(w.row, w.col));
        const paint = historyPaints?.[historyPaints.length - 1] ?? { base: '#1a2030' };
        const bg = uprightish ? theme.scene.plate : paint.base;
        const ring = rescinded ? '#fb7185' : pending ? '#f59e0b' : null;
        return (
          <div
            key={`${w.row}-${w.col}`}
            data-well-idx={i}
            style={{ position: 'absolute', left: x - 14, top: y - 14, width: 28, height: 28, transformStyle: 'preserve-3d', cursor: 'pointer' }}
          >
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: uprightish ? bg : discBackground(paint),
                border: isSelected ? '2px solid #38bdf8' : ring ? `2px solid ${ring}` : uprightish ? '1px solid rgba(148,163,200,0.22)' : '1px solid rgba(0,0,0,0.5)',
                transform: `translateZ(${h}px)`,
                boxShadow: isSelected ? '0 0 12px #38bdf8' : rescinded ? '0 0 10px rgba(251,113,133,0.7)' : pending ? '0 0 8px rgba(245,158,11,0.5)' : uprightish ? 'inset 0 2px 6px rgba(0,0,0,0.8)' : '0 1px 2px rgba(0,0,0,0.6)',
                transition: 'transform 420ms cubic-bezier(0.2,0.8,0.2,1), background-color 280ms ease',
              }}
            >
              {rescinded && !uprightish && (
                <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1, color: '#fb7185', fontWeight: 700 }}>⦸</span>
              )}
            </div>
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                backgroundColor: bg, opacity: uprightish ? 0 : 0.35, border: '1px solid rgba(0,0,0,0.4)',
                transform: `translateZ(${h / 2}px)`,
                transition: 'transform 420ms cubic-bezier(0.2,0.8,0.2,1), opacity 200ms',
              }}
            />
            {/* stack preview hoops — one per extra result (max 3) */}
            {!uprightish && n > 1 && Array.from({ length: Math.min(3, n - 1) }).map((_, k) => (
              <div
                key={k}
                aria-hidden
                style={{
                  position: 'absolute', inset: 2, borderRadius: '50%',
                  border: '1.5px solid rgba(94,234,212,0.85)',
                  transform: `translateZ(${h + 6 + k * 6}px)`,
                  boxShadow: '0 0 6px rgba(45,212,191,0.35)',
                  pointerEvents: 'none',
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
});
