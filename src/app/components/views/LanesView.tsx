import { useCorridorReadScope } from '../../services/useCorridorReadScope';
import { useGuide } from '../guide/GuideProvider';
import { useGuideScene, useGuidePlate } from '../guide/useGuideScene';
import { recordTitle } from '../../services/cartographyService';
import { useTheme } from '../../theme/ThemeProvider';
import { withAlpha } from '../../theme/theme';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ownsSceneInput, useSceneDrag } from '../useSceneDrag';
import { useReducedMotion } from 'motion/react';
import { useDocumentVisible } from '../useDocumentVisible';
import { LANES_SCENE_SHORTCUTS, useLanesShortcuts } from '../useLanesShortcuts';
import { startSceneLoop } from '../sceneLoop';
import {
  Eye, EyeOff, Focus, Layers as LayersIcon, RotateCcw,
  Play, Pause, ZoomIn, ZoomOut, Compass, Grid3x3, Workflow,
  ArrowRight, ExternalLink, Flag,
} from 'lucide-react';
import { STORE } from '../../data';
import { useSearch, matchesQuery } from '../../services/search';
import { SearchField } from '../SearchField';
import type {
  Lane, LaneCard, LaneCardKind, LaneId, Well,
} from '../../types';
import { PLATE_ID, groupResultsByWell, wellIdOf } from '../../data/wellResults';
import { PlateScene3D } from '../plate/PlateScene3D';
import { PlateIndexPanel } from '../plate/PlateIndexPanel';
import { PlateControls } from '../plate/PlateControls';
import { PlateWorkspace } from '../plate/PlateWorkspace';
import type { PlateRail } from '../plate/PlateWorkspace';
import { PlateHistorySource } from '../plate/PlateHistorySource';
import { usePlateHistory } from '../../services/plateHistory/context';
import { WellDetail } from '../plate/WellPanels';
import { indexResultWells, preferredResult } from '../plate/plateState';
import type { PlateStackUi, StackFocus } from '../plate/plateState';

import {
  cardStyle, CorridorScene, DEFAULT_CONTROL, FLAG_STYLE, LANE_LENGTH_PX, PENNANT_COLOR,
} from '../corridor/CorridorScene';
import type { ControlState, SceneMode } from '../corridor/CorridorScene';
import { CORRIDOR_PITCH, CORRIDOR_PRESETS, displayCorridorYaw, nearestCorridorYaw, orbitCorridor } from '../corridor/corridorCamera';
import type { CorridorPreset } from '../corridor/corridorCamera';
import { useCorridorPresetMotion } from '../corridor/useCorridorPresetMotion';
import { useCorridorExploration, useExplorationNavigation, usePlateExploration } from '../../services/exploration/ExplorationProvider';
import type { CorridorReference, RecordSection } from '../../services/recordNavigation';

// ===== View props ============================================================

export interface LanesViewProps {
  active?: boolean;
  onCrossNavigate?: (reference: CorridorReference) => void;
}

// ============================================================================

export function LanesView(props: LanesViewProps) {
  return <LanesAtlas {...props} />;
}

function LanesAtlas({ onCrossNavigate, active = true }: LanesViewProps) {
  const corridorAccess = useCorridorReadScope();
  const guide = useGuide();
  const [historyReady, setHistoryReady] = useState(false);
  const { query } = useSearch();
  const documentVisible = useDocumentVisible();
  const reducedMotion = useReducedMotion() ?? false;
  const animationEligible = active && documentVisible && !reducedMotion;
  const lanes = STORE.lanes;
  const cards = STORE.laneCards;
  const arrows = STORE.laneArrows;
  const flags = STORE.laneFlags;
  const surfaceLabels = STORE.laneSurfaceLabels;

  const { control: ctrl, setControl: setCtrl } = useCorridorExploration();
  const { selectScene } = useExplorationNavigation();
  const onScene = useCallback((scene: SceneMode) => selectScene(scene, 'desktop'), [selectScene]);
  useLanesShortcuts(active && documentVisible, onScene);
  const { plateUi, setPlateUi, selectedWellId, setSelectedWellId,
    focus: stackFocus, setFocus: setStackFocus } = usePlateExploration();
  const presetMotion = useCorridorPresetMotion({
    camera: { pitch: ctrl.tiltX, yaw: ctrl.tiltZ, panX: ctrl.panX, panY: ctrl.panY, zoom: ctrl.zoom },
    onChange: ({ pitch, yaw, panX, panY, zoom }) => setCtrl((previous) => ({ ...previous, tiltX: pitch, tiltZ: yaw, panX, panY, zoom })),
    enabled: active && documentVisible && ctrl.scene === 'corridor',
    reducedMotion,
  });
  function resetCorridor() {
    // Filters and travel reset immediately; only the explored camera returns through a spring.
    setCtrl((current) => ({ ...DEFAULT_CONTROL, tiltX: current.tiltX, tiltZ: current.tiltZ, panX: current.panX, panY: current.panY, zoom: current.zoom }));
    presetMotion.reset({ pitch: DEFAULT_CONTROL.tiltX, yaw: DEFAULT_CONTROL.tiltZ, panX: DEFAULT_CONTROL.panX, panY: DEFAULT_CONTROL.panY, zoom: DEFAULT_CONTROL.zoom });
  }
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current && selectedCardId) {
      root.current?.querySelector<HTMLElement>(`[data-corridor-card="${CSS.escape(selectedCardId)}"]`)?.focus({ preventScroll: true });
    }
    wasActive.current = active;
  }, [active, selectedCardId]);
  const [plateRail, setPlateRail] = useState<PlateRail>(null);
  const [selectedLane, setSelectedLane] = useState<LaneId | null>(null);
  const setSelectedWell = (well: Well | null) => setSelectedWellId(well ? wellIdOf(well.row, well.col) : null);
  const [travelX, setTravelX] = useState(0);

  // Plate scene — upright result stacks. Focus is the result whose record is
  // unfurled in the tray; it is shared with the detail panel's result list.
  const exampleResults = useMemo(() => groupResultsByWell(STORE.wellResults), []);
  const historyWellId = selectedWellId;
  const history = usePlateHistory(PLATE_ID, historyWellId, active && ctrl.scene === 'plate', exampleResults, STORE.plate);
  const wells = history.wells;
  const selectedWell = wells.find((well) => wellIdOf(well.row, well.col) === selectedWellId) ?? null;
  const resultsByWell = history.stacks;
  useGuideScene(active, step => {
    if (step === 'workflow') {
      if (!corridorAccess.ok) { if (guide.request) guide.acknowledge(guide.request.id, 'unavailable'); return; }
      setCtrl(previous => ({ ...DEFAULT_CONTROL, tiltX: previous.tiltX, tiltZ: previous.tiltZ, panX: previous.panX, panY: previous.panY, zoom: previous.zoom }));
      const id = guide.request!.id;
      presetMotion.reset({ pitch: 48, yaw: -22, panX: 0, panY: 0, zoom: .65 }, () => { if (guide.ownsRequest(id)) guide.acknowledge(id, 'ready'); });
      return presetMotion.cancel;
    }
    setPlateRail(null);
  });
  useGuidePlate({ active: active && ctrl.scene === 'plate', wellId: selectedWellId, phase: history.phase,
    results: resultsByWell.get('C3') ?? [], sceneReady: historyReady, setFocus: setStackFocus });
  const resultWells = useMemo(() => indexResultWells(resultsByWell), [resultsByWell]);
  const multiCount = useMemo(() => [...resultsByWell.values()].filter((l) => l.length > 1).length, [resultsByWell]);
  useEffect(() => {
    if (history.phase !== 'ready' || !history.history) return;
    const results = history.history.results;
    setStackFocus((current) => {
      if (!current || results.some((result) => result.id === current.resultId)) return current;
      const previewWell = resultWells.get(current.resultId);
      if (previewWell && previewWell !== historyWellId) return current;
      const resultId = preferredResult(results);
      return resultId ? { ...current, resultId } : null;
    });
  }, [history.phase, history.history, historyWellId, resultWells]);
  const focusResult = (next: StackFocus | null) => {
    setStackFocus(next);
    const wellId = next?.pinned ? resultWells.get(next.resultId) : undefined;
    const well = wells.find((item) => wellIdOf(item.row, item.col) === wellId);
    if (well) setSelectedWell(well);
  };
  const patchPlateUi = (patch: Partial<PlateStackUi>) => setPlateUi((p) => ({ ...p, ...patch }));
  const openResult = (resultId: string) => {
    setStackFocus({ resultId, pinned: true });
    setPlateUi((p) => (p.upright ? p : { ...p, upright: true }));
    const wid = resultWells.get(resultId);
    const well = wells.find((w) => wellIdOf(w.row, w.col) === wid);
    if (well) setSelectedWell(well);
  };
  const openWell = (wellId: string) => {
    const list = resultsByWell.get(wellId);
    if (list?.length) {
      openResult(list[list.length - 1].id);
      setPlateRail(null);
    }
  };

  // camera-on-rails
  useEffect(() => {
    if (!ctrl.travel || ctrl.scene !== 'corridor' || !animationEligible) return;
    return startSceneLoop((elapsed) => {
      setTravelX((previous) => {
        const next = previous + elapsed * 0.08;
        return next > LANE_LENGTH_PX + 200 ? -300 : next;
      });
    }, { now: () => performance.now(), request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id) });
  }, [ctrl.travel, ctrl.scene, animationEligible]);

  const visibleLanes = useMemo<ReadonlyArray<Lane>>(() => {
    return lanes
      .filter((l) => !ctrl.hidden.has(l.id))
      .filter((l) => ctrl.viewMode === 'all' || l.stage === ctrl.viewMode)
      .filter((l) => ctrl.focused == null || l.id === ctrl.focused);
  }, [lanes, ctrl.hidden, ctrl.viewMode, ctrl.focused]);

  const visibleCards = useMemo<ReadonlyArray<LaneCard>>(() => {
    return cards
      .filter((c) => !ctrl.hideKinds.has(c.kind))
      .filter((c) => visibleLanes.some((l) => l.id === c.laneId))
      .filter((c) => matchesQuery(query, c.label, c.note, c.id, c.laneId));
  }, [cards, ctrl.hideKinds, visibleLanes, query]);

  function toggleHide(laneId: LaneId) {
    setCtrl((p) => {
      const next = new Set(p.hidden);
      if (next.has(laneId)) next.delete(laneId); else next.add(laneId);
      return { ...p, hidden: next };
    });
  }
  function toggleFocus(laneId: LaneId) {
    presetMotion.cancel();
    setCtrl((p) => ({ ...p, focused: p.focused === laneId ? null : laneId }));
  }
  function toggleKind(kind: LaneCardKind) {
    setCtrl((p) => {
      const next = new Set(p.hideKinds);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return { ...p, hideKinds: next };
    });
  }

  const travelOffset = ctrl.travel ? -((travelX % LANE_LENGTH_PX) - LANE_LENGTH_PX / 2) : 0;
  const sceneTransform = `translate(-50%, -50%) translate(${ctrl.panX}px, ${ctrl.panY}px) scale(${ctrl.zoom}) rotateX(${ctrl.tiltX}deg) rotateZ(${ctrl.tiltZ}deg) translateX(${travelOffset}px)`;

  // Camera orbit — drag = yaw (Z) + pitch (X); shift / right / middle drag = pan;
  // wheel = zoom. A 4px threshold keeps card & lane clicks working.
  const orbit = useSceneDrag({
    enabled: active && ctrl.scene === 'corridor',
    threshold: 4,
    onMove: ({ dx, dy, mode }) => setCtrl((p) => {
      if (mode === 'pan') return { ...p, panX: p.panX + dx, panY: p.panY + dy };
      const next = orbitCorridor(p.tiltX, p.tiltZ, dx, dy);
      return { ...p, tiltX: next.pitch, tiltZ: next.yaw };
    }),
  });
  const onOrbitWheel = (e: React.WheelEvent) => {
    if (!active || ctrl.scene !== 'corridor' || ownsSceneInput(e.target)) return;
    presetMotion.cancel();
    setCtrl((p) => ({ ...p, zoom: Math.max(0.2, Math.min(2.4, p.zoom - e.deltaY * 0.0012)) }));
  };

  const focused = ctrl.focused ? lanes.find((l) => l.id === ctrl.focused) ?? null : null;
  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) ?? null : null;

  if (!corridorAccess.ok && ctrl.scene === 'corridor') return <p className="p-6 text-sm text-[var(--sot-shell-muted)]" role="status">{corridorAccess.reason}</p>;

  const scene = (
    <div
      className="flex-1 min-w-0 relative overflow-hidden select-none"
      style={{ background: 'var(--sot-scene-background)', cursor: ctrl.scene === 'corridor' ? (orbit.mode ? (orbit.mode === 'pan' ? 'move' : 'grabbing') : 'grab') : undefined }}
      onPointerDown={(event) => {
        if (ctrl.scene === 'corridor' && !ownsSceneInput(event.target)) presetMotion.cancel();
        orbit.onPointerDown(event);
      }}
      onPointerMove={orbit.onPointerMove}
      onPointerUp={orbit.onPointerUp}
      onPointerCancel={orbit.onPointerCancel}
      onLostPointerCapture={orbit.onLostPointerCapture}
      onPointerLeave={orbit.onPointerLeave}
      onClickCapture={orbit.onClickCapture}
      onContextMenu={(e) => { if (ctrl.scene === 'corridor') e.preventDefault(); }}
      onWheel={onOrbitWheel}
    >
      <CanvasBackdrop animated={animationEligible} />

      {ctrl.scene === 'corridor' ? (
        <CorridorScene
          ctrl={ctrl}
          sceneTransform={sceneTransform}
          visibleLanes={visibleLanes}
          visibleCards={visibleCards}
          arrows={arrows}
          flags={flags}
          surfaceLabels={surfaceLabels}
          travelX={ctrl.travel ? travelX : null}
          selectedCardId={selectedCardId}
          onCardClick={setSelectedCardId}
          onLaneClick={setSelectedLane}
        />
      ) : (
        <PlateScene3D
          onHistoryReady={setHistoryReady}
          wells={wells}
          resultsByWell={resultsByWell}
          ui={plateUi}
          onUiChange={patchPlateUi}
          focus={stackFocus}
          onFocusChange={focusResult}
          onWellClick={(w) => setSelectedWell(w)}
          selectedWell={selectedWell}
          historySource={{ wellId: historyWellId, ...history }}
          historySourceFor={history.sourceFor}
        />
      )}

      {ctrl.scene === 'corridor' && (
        <div className="absolute top-3 left-3 z-10 text-[9px] font-mono text-[var(--sot-shell-muted)] pointer-events-none">
          drag · pitch + yaw · shift / right-drag · pan · wheel · zoom
        </div>
      )}
      <AxisLegend scene={ctrl.scene} upright={plateUi.upright} />
    </div>
  );

  return (
    <div ref={root} className="flex flex-col h-full min-w-0">
      <ControlBar ctrl={ctrl} setCtrl={setCtrl} toggleKind={toggleKind} plateUi={plateUi} onPlateUi={patchPlateUi} multiCount={multiCount} onPreset={presetMotion.select} onReset={resetCorridor} onDirectCamera={presetMotion.cancel} onScene={onScene} />
      {ctrl.scene === 'plate' && !plateUi.upright && <PlateHistorySource wellId={historyWellId} {...history} />}
      {ctrl.scene === 'plate' ? (
        <PlateWorkspace
          panel={plateRail}
          onPanelChange={setPlateRail}
          sampleLabel={selectedWellId}
          histories={<PlateIndexPanel stacks={resultsByWell} rules={STORE.lifecycleRules}
            focusWellId={stackFocus ? resultWells.get(stackFocus.resultId) ?? null : null}
            upright={plateUi.upright} onOpen={openWell} />}
          sample={selectedWell ? <WellDetail well={selectedWell}
            results={resultsByWell.get(wellIdOf(selectedWell.row, selectedWell.col)) ?? []}
            focusedResultId={stackFocus?.resultId ?? null} upright={plateUi.upright}
            onSelectResult={openResult}
            onClose={() => { setSelectedWell(null); setPlateRail(null); }} />
            : <p className="p-3 text-[11px] text-[var(--sot-shell-muted)]">Select a well to inspect its sample and results.</p>}
        >{scene}</PlateWorkspace>
      ) : (
        <div className="flex flex-1 min-h-0">
          <PartitionPanel lanes={lanes} ctrl={ctrl} onToggleHide={toggleHide} onToggleFocus={toggleFocus} onSelect={setSelectedLane} />
          {scene}
          <CorridorDetailPanel lanes={lanes} cards={cards} focused={focused} selectedLane={selectedLane}
            selectedCard={selectedCard} onClose={() => { setSelectedCardId(null); setSelectedWell(null); }}
            onCrossNavigate={onCrossNavigate} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Control bar
// =============================================================================

function ControlBar({
  ctrl, setCtrl, toggleKind, plateUi, onPlateUi, multiCount, onPreset, onReset, onDirectCamera, onScene,
}: {
  ctrl: ControlState;
  setCtrl: React.Dispatch<React.SetStateAction<ControlState>>;
  toggleKind: (k: LaneCardKind) => void;
  plateUi: PlateStackUi;
  onPlateUi: (patch: Partial<PlateStackUi>) => void;
  multiCount: number;
  onPreset: (preset: CorridorPreset) => void;
  onReset: () => void;
  onDirectCamera: () => void;
  onScene: (scene: SceneMode) => void;
}) {
  const { query, setQuery } = useSearch();
  const head = (
    <>
      <div className="flex items-center gap-1.5">
        <Compass size={11} className="text-teal-400" />
        <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Atlas</span>
      </div>

      <div className="flex border border-[var(--sot-shell-strong-border)]/[0.1] rounded overflow-hidden">
        {LANES_SCENE_SHORTCUTS.map(({ scene, key }) => (
          <button
            key={scene}
            onClick={() => onScene(scene)}
            aria-keyshortcuts={key}
            aria-pressed={ctrl.scene === scene}
            className="text-[10px] font-mono px-2 py-0.5 flex items-center gap-1"
            style={{ backgroundColor: ctrl.scene === scene ? 'var(--sot-status-success)' : 'transparent', color: ctrl.scene === scene ? 'var(--sot-shell-on-accent)' : 'var(--sot-shell-muted)' }}
          >
            {scene === 'corridor' ? <Workflow size={10} /> : <Grid3x3 size={10} />} {scene}
            <kbd aria-hidden="true" className="ml-1 rounded border border-current px-1 text-[8px] leading-3">{key}</kbd>
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-[var(--sot-shell-text)]/10" />
    </>
  );

  // The plate scene has its own camera; corridor controls (pitch/yaw, travel,
  // arrows) don't apply, so it gets the result-stack controls instead.
  if (ctrl.scene === 'plate') {
    return (
      <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-background)]/80 flex-shrink-0 flex-wrap">
        {head}
        <PlateControls ui={plateUi} onChange={onPlateUi} multiCount={multiCount} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-background)]/80 flex-shrink-0 flex-wrap">
      {head}
      <SearchField label="Find corridor cards" placeholder="Find corridor cards" value={query} onChange={setQuery} className="w-48" />

      {(['all', 'wet_lab', 'dry_lab', 'interpretation'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setCtrl((p) => ({ ...p, viewMode: m }))}
          className="text-[10px] font-mono px-2 py-0.5 rounded border"
          style={{
            color: ctrl.viewMode === m ? 'var(--sot-shell-on-accent)' : 'var(--sot-shell-muted)',
            backgroundColor: ctrl.viewMode === m ? 'var(--sot-status-success)' : 'transparent',
            borderColor: ctrl.viewMode === m ? 'var(--sot-status-success)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)',
          }}
        >
          {m.replace('_', ' ')}
        </button>
      ))}

      <div className="w-px h-4 bg-[var(--sot-shell-text)]/10" />
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase">Hide:</span>
      {(['process', 'state_major', 'state_minor', 'control'] as const).map((k) => {
        const cs = cardStyle(k);
        const off = ctrl.hideKinds.has(k);
        return (
          <button
            key={k}
            onClick={() => toggleKind(k)}
            className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border"
            style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)', opacity: off ? 0.4 : 1, color: 'var(--sot-shell-muted)' }}
            title={`${off ? 'Show' : 'Hide'} ${cs.label}`}
          >
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cs.bg, border: `1px solid ${cs.border}` }} />
            {cs.label}
          </button>
        );
      })}

      <div className="w-px h-4 bg-[var(--sot-shell-text)]/10" />
      <button
        onClick={() => setCtrl((p) => ({ ...p, showArrows: !p.showArrows }))}
        className="text-[10px] font-mono px-2 py-0.5 rounded border"
        style={{
          color: ctrl.showArrows ? 'var(--sot-shell-on-accent)' : 'var(--sot-shell-muted)',
          backgroundColor: ctrl.showArrows ? 'var(--sot-status-warning)' : 'transparent',
          borderColor: ctrl.showArrows ? 'var(--sot-status-warning)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)',
        }}
      >
        <ArrowRight size={10} className="inline -mt-px" /> arrows
      </button>
      <button
        onClick={() => { onDirectCamera(); setCtrl((p) => ({ ...p, travel: !p.travel })); }}
        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border"
        style={{
          color: ctrl.travel ? 'var(--sot-shell-on-accent)' : 'var(--sot-shell-muted)',
          backgroundColor: ctrl.travel ? 'var(--sot-status-info)' : 'transparent',
          borderColor: ctrl.travel ? 'var(--sot-status-info)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)',
        }}
      >
        {ctrl.travel ? <Pause size={10} /> : <Play size={10} />} travel
      </button>
      <button aria-label="Zoom corridor in" onClick={() => { onDirectCamera(); setCtrl((p) => ({ ...p, zoom: Math.min(1.6, p.zoom + 0.1) })); }} className="text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]"><ZoomIn size={12} /></button>
      <button aria-label="Zoom corridor out" onClick={() => { onDirectCamera(); setCtrl((p) => ({ ...p, zoom: Math.max(0.35, p.zoom - 0.1) })); }} className="text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]"><ZoomOut size={12} /></button>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">pitch</span>
        <input aria-label="Corridor pitch" type="range" min={CORRIDOR_PITCH.min} max={CORRIDOR_PITCH.max} step={0.1} value={ctrl.tiltX} onChange={(e) => { onDirectCamera(); setCtrl((p) => ({ ...p, tiltX: Number(e.target.value) })); }} className="w-16 accent-teal-400" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">yaw</span>
        <input aria-label="Corridor yaw" type="range" min={-180} max={180} step={0.1} value={displayCorridorYaw(ctrl.tiltZ)} onChange={(e) => { onDirectCamera(); setCtrl((p) => ({ ...p, tiltZ: nearestCorridorYaw(Number(e.target.value), p.tiltZ) })); }} className="w-16 accent-teal-400" />
      </div>
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] tabular-nums w-24">
        {Math.round(ctrl.tiltX)}° · {Math.round(displayCorridorYaw(ctrl.tiltZ))}°{ctrl.panX || ctrl.panY ? ' · panned' : ''}
      </span>
      <div className="flex items-center gap-0.5">
        {CORRIDOR_PRESETS.map((preset) => (
          <button key={preset.label} onClick={() => onPreset(preset)}
            className="text-[8px] font-mono px-1 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">{preset.label}</button>
        ))}
      </div>
      <button onClick={onReset} className="flex items-center gap-1 text-[10px] font-mono text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">
        <RotateCcw size={10} /> reset
      </button>
    </div>
  );
}

// =============================================================================
// Partition panel
// =============================================================================

function PartitionPanel({
  lanes, ctrl, onToggleHide, onToggleFocus, onSelect,
}: {
  lanes: ReadonlyArray<Lane>;
  ctrl: ControlState;
  onToggleHide: (id: LaneId) => void;
  onToggleFocus: (id: LaneId) => void;
  onSelect: (id: LaneId) => void;
}) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-inset)] overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Partitioning</span>
      </div>
      <div className="p-2 space-y-1">
        {lanes.map((lane) => {
          const isHidden = ctrl.hidden.has(lane.id);
          const isFocused = ctrl.focused === lane.id;
          return (
            <div
              key={lane.id}
              className="rounded border px-2 py-1.5"
              style={{
                borderColor: isFocused ? lane.color : 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)',
                backgroundColor: isFocused ? `color-mix(in srgb, ${lane.color} 13.333%, transparent)` : 'transparent',
                opacity: isHidden ? 0.4 : 1,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: lane.color }} />
                <button
                  className="flex-1 text-left text-[10px] font-mono text-[var(--sot-shell-text)] truncate"
                  onClick={() => onSelect(lane.id)}
                >
                  {lane.label}
                </button>
                <button onClick={() => onToggleHide(lane.id)} title={isHidden ? 'Show' : 'Hide'} className="text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">
                  {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                </button>
                <button onClick={() => onToggleFocus(lane.id)} title="Focus" className="text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">
                  <Focus size={10} style={{ color: isFocused ? lane.color : undefined }} />
                </button>
              </div>
              <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-0.5">{lane.stage.replace('_', ' ')}</div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-b border-[var(--sot-shell-strong-border)]/[0.05]">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Streams</span>
      </div>
      <div className="p-2 space-y-1">
        {STORE.streams.map((s) => (
          <div key={s.id} className="text-[9px] font-mono text-[var(--sot-shell-muted)] flex justify-between">
            <span className="truncate">{s.label}</span>
            <span className="text-[var(--sot-shell-muted)] ml-1.5">{s.format}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Canvas backdrop — particle field
// =============================================================================

function CanvasBackdrop({ animated }: { animated: boolean }) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useMemo(() => Array.from({ length: 110 }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3,
    vx: (Math.random() - 0.5) * 0.0006,
    vy: (Math.random() - 0.5) * 0.0006,
    alternate: Math.random() < 0.5,
  })), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      draw(false);
    }

    function draw(advance: boolean) {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = withAlpha(theme.scene.grid, .45);
      ctx.lineWidth = 1;
      const gridSize = 48 * dpr;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (const p of particles) {
        if (advance) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > 1) p.vx *= -1;
          if (p.y < 0 || p.y > 1) p.vy *= -1;
        }
        ctx.fillStyle = p.alternate ? theme.scene.alternateParticle : theme.scene.particle;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    resize();
    window.addEventListener('resize', resize);
    const stop = animated ? startSceneLoop(() => draw(true), {
      now: () => performance.now(), request: (callback) => requestAnimationFrame(callback), cancel: (id) => cancelAnimationFrame(id),
    }) : undefined;
    return () => {
      stop?.();
      window.removeEventListener('resize', resize);
    };
  }, [animated, particles, theme.scene]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// =============================================================================
// Axis legend
// =============================================================================

function AxisLegend({ scene, upright }: { scene: SceneMode; upright: boolean }) {
  if (scene === 'plate') {
    return null;
  }
  return null;
}

// =============================================================================
// Detail panel
// =============================================================================

function CorridorDetailPanel({
  lanes, cards, focused, selectedLane, selectedCard, onClose, onCrossNavigate,
}: {
  lanes: ReadonlyArray<Lane>;
  cards: ReadonlyArray<LaneCard>;
  focused: Lane | null;
  selectedLane: LaneId | null;
  selectedCard: LaneCard | null;
  onClose: () => void;
  onCrossNavigate?: LanesViewProps['onCrossNavigate'];
}) {
  function jump(section: RecordSection, entityId: string) {
    if (selectedCard) onCrossNavigate?.({ target: { section, entityId }, origin: { cardId: selectedCard.id, label: selectedCard.label } });
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-inset)] overflow-y-auto">
      {selectedCard ? (
        <CardDetail card={selectedCard} onClose={onClose} jump={jump} />
      ) : focused ? (
        <LaneDetail lane={focused} cards={cards} />
      ) : selectedLane ? (
        <LaneDetail lane={lanes.find((l) => l.id === selectedLane)!} cards={cards} />
      ) : (
        <DraftingKey cards={cards} />
      )}
    </div>
  );
}

function CardDetail({
  card, onClose, jump,
}: {
  card: LaneCard;
  onClose: () => void;
  jump: (section: RecordSection, entityId: string) => void;
}) {
  const cs = cardStyle(card.kind);
  const refs = card.crossRefs;
  return (
    <div data-corridor-card={card.id} tabIndex={-1} className="p-3 outline-sky-400">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Card</span>
        <button onClick={onClose} className="text-[10px] text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">✕</button>
      </div>
      <div className="rounded border" style={{ borderColor: cs.border, backgroundColor: cs.bg, color: cs.fg, padding: '8px 10px', borderTop: `4px solid ${cs.topStripe}` }}>
        <div className="text-[11px]" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{card.label}</div>
        {card.note && <div className="text-[9px] mt-0.5 opacity-80">{card.note}</div>}
      </div>
      <div className="mt-3 text-[10px] font-mono text-[var(--sot-shell-muted)] space-y-1">
        <div className="flex justify-between"><span>id</span><span className="text-[var(--sot-shell-text)]">{card.id}</span></div>
        <div className="flex justify-between"><span>lane</span><span className="text-[var(--sot-shell-text)]">{card.laneId}</span></div>
        <div className="flex justify-between"><span>kind</span><span className="text-[var(--sot-shell-text)]">{card.kind}</span></div>
        <div className="flex justify-between"><span>position</span><span className="text-[var(--sot-shell-text)]">{Math.round(card.position * 100)}%</span></div>
        {card.contaminationProb != null && (
          <div className="flex justify-between"><span>P(contam)</span><span style={{ color: card.contaminationProb > 0.3 ? 'var(--sot-status-danger)' : 'var(--sot-status-success)' }}>{(card.contaminationProb * 100).toFixed(0)}%</span></div>
        )}
        {card.streamRef && <div className="flex justify-between"><span>stream</span><span className="text-sky-400">{card.streamRef}</span></div>}
      </div>

      {card.nested && card.nested.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase mb-1">Nested</div>
          <div className="flex gap-1 flex-wrap">
            {card.nested.map((n) => (
              <span key={n.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.1] text-[var(--sot-shell-text)]">{n.label}</span>
            ))}
          </div>
        </div>
      )}

      {refs && (
        <div className="mt-4 pt-3 border-t border-[var(--sot-shell-strong-border)]/[0.06] space-y-2">
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Related records</div>
          {(['sources', 'instructions', 'artifacts', 'comparisons', 'decisions'] as const).map((section) => {
            const list =
              section === 'sources' ? refs.sourceIds :
              section === 'instructions' ? refs.instructionIds :
              section === 'artifacts' ? refs.artifactIds :
              section === 'comparisons' ? refs.comparisonIds :
              refs.decisionIds;
            if (!list || list.length === 0) return null;
            return (
              <div key={section}>
                <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase mb-1">{section}</div>
                <div className="space-y-1">
                  {list.map((id) => (
                    <button
                      key={id}
                      onClick={() => jump(section, id)}
                      className="w-full flex items-center justify-between text-left text-[10px] font-mono px-2 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.06] text-[var(--sot-shell-text)]"
                    >
                      <span className="truncate">{recordTitle(section, id)}</span>
                      <ExternalLink size={10} className="text-[var(--sot-shell-muted)] flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LaneDetail({ lane, cards }: { lane: Lane; cards: ReadonlyArray<LaneCard> }) {
  const laneCards = cards.filter((c) => c.laneId === lane.id);
  const laneFlags = STORE.laneFlags.filter((f) => f.laneId === lane.id);
  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Lane</div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: lane.color }} />
          <span className="text-[12px] text-[var(--sot-shell-text)]">{lane.label}</span>
        </div>
        <div className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed">{lane.description}</div>
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1.5">stage · {lane.stage.replace('_', ' ')}</div>
      </div>
      <div>
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Cards</div>
        <div className="space-y-1">
          {laneCards.map((c) => {
            const cs = cardStyle(c.kind);
            return (
              <div key={c.id} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: cs.bg }} />
                <span className="text-[var(--sot-shell-text)] truncate flex-1">{c.label}</span>
                <span className="text-[var(--sot-shell-muted)]">{Math.round(c.position * 100)}%</span>
              </div>
            );
          })}
        </div>
      </div>
      {laneFlags.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Flags</div>
          <div className="space-y-1">
            {laneFlags.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 text-[10px]">
                <Flag size={10} style={{ color: FLAG_STYLE[f.kind].bg }} />
                <span className="text-[var(--sot-shell-text)] flex-1">{f.label}</span>
                <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{f.sublabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Connections</div>
        <div className="space-y-1">
          {STORE.connections.filter((c) => c.laneId === lane.id).map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${c.online ? 'bg-teal-400' : 'bg-rose-400'}`} />
              <span className="text-[var(--sot-shell-text)] truncate flex-1">{c.label}</span>
              <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{c.vendor}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DraftingKey({ cards }: { cards: ReadonlyArray<LaneCard> }) {
  return (
    <div className="p-3 space-y-1.5">
      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Drafting key</div>
      {(['process', 'state_major', 'state_minor', 'control'] as const).map((k) => {
        const cs = cardStyle(k);
        return (
          <div key={k} className="flex items-center gap-2 text-[10px]">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cs.bg, border: `1px solid ${cs.border}` }} />
            <span className="text-[var(--sot-shell-text)] flex-1">{cs.label}</span>
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{cards.filter((c) => c.kind === k).length}</span>
          </div>
        );
      })}
      <div className="mt-3 pt-3 border-t border-[var(--sot-shell-strong-border)]/[0.05]">
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Lane flags</div>
        {(['milestone','gate','handoff','checkered','caution'] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5 text-[10px]">
            <Flag size={10} style={{ color: FLAG_STYLE[k].bg }} />
            <span className="text-[var(--sot-shell-text)]">{k}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--sot-shell-strong-border)]/[0.05]">
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Pennants</div>
        {(['spe','per','drean','review','qc'] as const).map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-[10px]">
            <span style={{
              display: 'inline-block', width: 0, height: 0,
              borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
              borderTop: `10px solid ${PENNANT_COLOR[p].bg}`,
            }} />
            <span className="text-[var(--sot-shell-text)]">{p}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--sot-shell-strong-border)]/[0.05]">
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Tip</div>
        <div className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed">
          Run steps align to the Step Functions state machine — each step exposes its full manifest. Flags plant milestones, gates, handoffs.
          <LayersIcon size={10} className="inline text-teal-400" /> focus shows one corridor; ▶ travel follows the workflow.
        </div>
      </div>
    </div>
  );
}
