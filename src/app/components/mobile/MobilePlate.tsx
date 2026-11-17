import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { STORE } from '../../data';
import { PLATE_ID, RESULT_KIND_LABEL, RESULTS_AS_OF, groupResultsByWell, wellIdOf } from '../../data/wellResults';
import { ATHENA_LABEL, freezesWithin } from '../../services/dataAvailability';
import type { Well, WellResult } from '../../types';
import type { EnvironmentId } from '../../types/access';
import { useEnvironment } from '../../services/environment';
import { PlateOverlayProvider, usePlateOverlay } from '../plate/plateOverlay';
import { PlateScene3D } from '../plate/PlateScene3D';
import { PlateIndexPanel } from '../plate/PlateIndexPanel';
import { PlateLensLegend } from '../plate/PlateLensLegend';
import { PlateHistorySource } from '../plate/PlateHistorySource';
import { PlateHistoryProvider, usePlateHistory } from '../../services/plateHistory/context';
import { WellDetail } from '../plate/WellPanels';
import { CompactResultRecord, TraySummary } from '../plate/ResultTray';
import { plateFacts, platePosture } from '../plate/plateProjection';
import type { ResultFacts } from '../plate/plateProjection';
import { historyLayoutPatch, indexResultWells, preferredResult } from '../plate/plateState';
import type { PlateStackUi, StackFocus } from '../plate/plateState';
import { ROW_LABELS, shade, withAlpha } from '../plate/plateGeometry';
import { LENS_OPTIONS as LENSES, STATUS_LABEL, discBackground, discPaint } from '../plate/stackLens';
import { usePlateColors } from '../plate/usePlateColors';
import type { DiscPaint, StackLens } from '../plate/stackLens';
import { usePlateExploration } from '../../services/exploration/ExplorationProvider';
import { useGuide } from '../guide/GuideProvider';
import { useGuidePlate } from '../guide/useGuideScene';
import './mobile-plate.css';

const RESULTS = groupResultsByWell(STORE.wellResults);
const STORIES = [
  { well: 'B4', label: 'Tumor timeline' },
  { well: 'D6', label: 'QC recovery' },
  { well: 'E3', label: 'Consent hold' },
];
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

function discStyle(paint: DiscPaint): CSSProperties {
  return { background: discBackground(paint), outline: paint.ring ? `2px solid ${paint.ring}` : undefined, outlineOffset: 2 };
}

function lensMeaning(result: WellResult, lens: StackLens, facts: ResultFacts): string {
  if (result.status === 'cancelled') return STATUS_LABEL.cancelled;
  switch (lens) {
    case 'status': return STATUS_LABEL[result.status];
    case 'kind': return RESULT_KIND_LABEL[result.kind];
    case 'athena': return ATHENA_LABEL[facts.athena];
    case 'storage': {
      if (result.status === 'held') return 'Consent hold';
      const reads = facts.reads;
      if (!reads) return 'No reads file';
      if (reads.state === 'restored') return 'Restored copy';
      if (reads.state === 'restoring') return 'Restoring';
      const days = freezesWithin(reads);
      return `${reads.facts.short}${days == null ? '' : ` · freezes in ${days} ${days === 1 ? 'day' : 'days'}`}`;
    }
  }
}

function initialResult(well: string, stacks: ReadonlyMap<string, ReadonlyArray<WellResult>> = RESULTS): string | null {
  return preferredResult(stacks.get(well) ?? []);
}

/** Touch-sized receiving view of the existing plate and result model. */
export function MobilePlate({ active = true }: { active?: boolean }) {
  return <PlateHistoryProvider><PlateOverlayProvider><MobilePlateWorkspace active={active} /></PlateOverlayProvider></PlateHistoryProvider>;
}

function MobilePlateWorkspace({ active }: { active: boolean }) {
  const guide = useGuide();
  const [historyReady, setHistoryReady] = useState(false);
  const { theme, status: STATUS_COLOR } = usePlateColors();
  const overlay = usePlateOverlay();
  const { env, all, setEnv } = useEnvironment();
  const { plateUi: ui, setPlateUi: setUi, compactPlateView: view, setCompactPlateView: setView,
    selectedWellId: selectedWell, setSelectedWellId: setSelectedWell, focus, setFocus } = usePlateExploration();
  const lens = ui.lens;
  const setLens = (lens: StackLens) => setUi((current) => ({ ...current, lens }));
  const patchUi = useCallback((patch: Partial<PlateStackUi>) => setUi((current) => ({ ...current, ...patch })), []);
  const history = usePlateHistory(PLATE_ID, selectedWell, active, RESULTS, STORE.plate);
  const sourceStacks = history.stacks;
  const wells = history.wells;
  const wellsById = useMemo(() => new Map(wells.map((well) => [wellIdOf(well.row, well.col), well])), [wells]);
  const resultWells = useMemo(() => indexResultWells(sourceStacks), [sourceStacks]);
  const stacks = useMemo(() => new Map([...sourceStacks].map(([id, list]) => [id, list.map(overlay.apply)])), [sourceStacks, overlay.apply]);
  const facts = useMemo(() => plateFacts(stacks, overlay.athena), [stacks, overlay.athena]);
  const stats = useMemo(() => platePosture(stacks, facts), [stacks, facts]);
  const [sampleVisible, setSampleVisible] = useState(true);
  useEffect(() => {
    if (history.phase !== 'ready' || !history.history) return;
    const results = history.history.results;
    setFocus((current) => {
      if (!current || results.some((item) => item.id === current.resultId)) return current;
      const resultId = preferredResult(results);
      return resultId ? { ...current, resultId } : null;
    });
  }, [history.phase, history.history]);
  const boardRef = useRef<HTMLElement>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wellRefs = useRef(new Map<string, HTMLButtonElement>());
  const resultRefs = useRef(new Map<string, HTMLButtonElement>());
  const results = selectedWell ? stacks.get(selectedWell) ?? [] : [];
  const result = focus ? results.find((item) => item.id === focus.resultId) : undefined;
  const resultIndex = result ? results.indexOf(result) : -1;
  const selectedSample = wells.find((well) => wellIdOf(well.row, well.col) === selectedWell);
  useGuidePlate({ active, wellId: selectedWell, phase: history.phase, results, sceneReady: historyReady, setFocus });
  const presented = useRef<number | null>(null);
  useEffect(() => {
    const request = guide.request;
    if (!active || !request || request.step === 'workflow' || !guide.ownsRequest(request.id)
      || guide.state.phase !== 'touring' || guide.state.readiness !== 'ready' || presented.current === request.id) return;
    presented.current = request.id;
    (request.step === 'resources' ? detailRef : sceneRef).current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [active, guide]);
  useEffect(() => {
    if (!active || !guide.request || guide.request.step === 'workflow') return;
    const request = guide.request;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (guide.ownsRequest(request.id)) (request.step === 'resources' ? detailRef : sceneRef).current?.scrollIntoView({ block: 'start' });
      });
    };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frame); };
  }, [active, guide.request, guide.ownsRequest]);
  const paints = useMemo(() => new Map([...stacks.values()].flat().map((item) => [item.id, discPaint(item, lens, facts.get(item.id)!, theme.mode)])), [stacks, lens, facts, theme.mode]);
  const multiCount = [...sourceStacks.values()].filter((items) => items.length > 1).length;

  function chooseWell(id: string, scroll = true) {
    setSelectedWell(id);
    setSampleVisible(true);
    const resultId = initialResult(id, sourceStacks);
    setFocus(resultId ? { resultId, pinned: true } : null);
    if (!scroll) return;
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      detailRef.current?.focus({ preventScroll: true });
    });
  }

  function chooseResult(next: WellResult) {
    setFocus({ resultId: next.id, pinned: true });
    resultRefs.current.get(next.id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest', inline: 'nearest' });
  }

  const sceneFocus = useCallback((next: StackFocus | null) => {
    setFocus(next);
    const wellId = next ? resultWells.get(next.resultId) : undefined;
    if (wellId) setSelectedWell(wellId);
  }, [resultWells]);
  const sceneWell = useCallback((well: Well) => {
    const id = wellIdOf(well.row, well.col);
    setSelectedWell(id);
    setSampleVisible(true);
    const resultId = initialResult(id, sourceStacks);
    setFocus((current) => current && resultWells.get(current.resultId) === id ? current : resultId ? { resultId, pinned: true } : null);
  }, [resultWells, sourceStacks]);

  function returnToPlate() {
    boardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    const button = selectedWell ? wellRefs.current.get(selectedWell) : undefined;
    const scroller = boardScrollRef.current;
    if (button && scroller) {
      const buttonBounds = button.getBoundingClientRect();
      const scrollBounds = scroller.getBoundingClientRect();
      scroller.scrollTo({ left: scroller.scrollLeft + buttonBounds.left - scrollBounds.left - (scroller.clientWidth - buttonBounds.width) / 2, behavior: scrollBehavior() });
    }
    button?.focus({ preventScroll: true });
  }

  return (
    <div className="mobile-plate">
      <header className="mobile-plate-intro">
        <h1>Inside <span>the plate.</span></h1>
        <p>Every run, rerun, and discovery in one place.</p>
        <div className="mobile-plate-stats" aria-label="Plate summary">
          <span><strong>{wells.length}</strong> wells</span>
          <span><strong>{stats.results}</strong> results</span>
          <span><strong>{multiCount}</strong> with a history</span>
        </div>
      </header>

      <nav className="mobile-plate-stories" aria-label="Featured well stories">
        {STORIES.filter((story) => wellsById.has(story.well)).map((story) => (
          <button key={story.well} type="button" onClick={() => chooseWell(story.well)}>
            <span>{story.well}</span>{story.label}<ArrowRight size={13} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <details className="mobile-plate-story-index">
        <summary>All result stories & lifecycle policies <ChevronDown size={14} /></summary>
        <PlateIndexPanel compact stacks={stacks} rules={STORE.lifecycleRules} focusWellId={selectedWell} upright={ui.upright} onOpen={(id) => { chooseWell(id, false); setView('3d'); patchUi({ upright: true }); boardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }} />
      </details>

      <section className="mobile-plate-board-section" ref={boardRef} aria-labelledby="mobile-plate-board-title">
        <div className="mobile-plate-section-heading">
          <h2 id="mobile-plate-board-title">{PLATE_ID}</h2>
          <span className="mobile-plate-tap-hint">Tap a well to explore</span>
        </div>
        <div className="mobile-plate-view-switch" role="group" aria-label="Plate presentation">
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>Well board</button>
          <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D plate</button>
        </div>
        <div className="mobile-plate-lenses" role="group" aria-label="Color plate by">
          {LENSES.map((option) => <button type="button" key={option.id} aria-pressed={lens === option.id} onClick={() => setLens(option.id)}>{option.label}</button>)}
        </div>
        <PlateLensLegend lens={lens} />
        <div hidden={view !== 'board'}>
        <div className="mobile-plate-board-guide"><span>Color = latest result</span><span className="mobile-plate-swipe-hint">Swipe for all 12 columns <ArrowRight size={13} aria-hidden="true" /></span></div>

        <div className="mobile-plate-board-scroll" ref={boardScrollRef} tabIndex={0} role="region" aria-label="Scrollable 96-well plate. Swipe horizontally for more columns.">
          <div className="mobile-plate-board">
            <div className="mobile-plate-column-labels" aria-hidden="true"><span />{Array.from({ length: 12 }, (_, col) => <span key={col}>{col + 1}</span>)}</div>
            {Array.from(ROW_LABELS).map((rowLabel, row) => (
              <div className="mobile-plate-board-row" key={rowLabel}>
                <span className="mobile-plate-row-label" aria-hidden="true">{rowLabel}</span>
                {Array.from({ length: 12 }, (_, col) => {
                  const id = wellIdOf(row, col);
                  const well = wellsById.get(id);
                  if (!well) return <span key={id} className="mobile-plate-well" aria-label={`Well ${id}, outside current scope`} style={{ opacity: 0.25 }} />;
                  const stack = stacks.get(id) ?? [];
                  const latest = stack[stack.length - 1];
                  const paint = latest ? paints.get(latest.id)! : { base: '#334155' };
                  return (
                    <button type="button" key={id} className="mobile-plate-well" aria-pressed={selectedWell === id}
                      ref={(node) => { if (node) wellRefs.current.set(id, node); else wellRefs.current.delete(id); }}
                      aria-label={`Well ${id}, ${stack.length} ${stack.length === 1 ? 'result' : 'results'}${latest ? `, latest ${STATUS_LABEL[latest.status]}${lens === 'status' ? '' : `, ${LENSES.find((option) => option.id === lens)?.label}: ${lensMeaning(latest, lens, facts.get(latest.id)!)}`}` : ', empty'}`}
                      onClick={() => chooseWell(id)} style={{ '--well-color': paint.base } as CSSProperties}>
                      <span className="mobile-plate-well-seat" aria-hidden="true">
                        {stack.length > 2 && <i className="mobile-plate-well-layer mobile-plate-well-layer-back" />}
                        {stack.length > 1 && <i className="mobile-plate-well-layer" />}
                        <i className="mobile-plate-well-face" style={discStyle(paint)} />
                        {stack.length > 1 && <b>{stack.length}</b>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="mobile-plate-board-mark" aria-hidden="true"><span>NVSX / 2026</span><span>••• •• •••• ••</span><span>96</span></div>
          </div>
        </div>
        <div className="mobile-plate-board-caption"><span>Latest result on top · count = full history</span></div>
        </div>
        <div hidden={view !== '3d'}>
          <div className="mobile-plate-scene-options">
            <div role="group" aria-label="History spacing">{(['ordinal', 'time'] as const).map((spacing) => <button type="button" key={spacing} aria-pressed={ui.spacing === spacing} onClick={() => patchUi(historyLayoutPatch({ spacing }))}>{spacing === 'ordinal' ? 'By result' : 'Over time'}</button>)}</div>
            <div role="group" aria-label="History depth">{(['compact', 'spacious'] as const).map((spread) => <button type="button" key={spread} aria-pressed={ui.spread === spread} onClick={() => patchUi(historyLayoutPatch({ spread }))}>{spread === 'compact' ? 'Compact' : 'Spacious'}</button>)}</div>
            <button type="button" aria-pressed={ui.onlyMulti} onClick={() => patchUi({ onlyMulti: !ui.onlyMulti })}>Histories only · {multiCount}</button>
          </div>
          <div ref={sceneRef} className="mobile-plate-scene" aria-label="Interactive 3D plate">
            <PlateScene3D onHistoryReady={setHistoryReady} presentation="compact" active={active && view === '3d'} wells={wells} resultsByWell={sourceStacks} ui={ui} onUiChange={patchUi} focus={focus} onFocusChange={sceneFocus} selectedWell={selectedSample ?? null} onWellClick={sceneWell} />
          </div>
          <div className="mobile-plate-board-guide"><span>{ui.upright ? 'Drag to explore · tap a result to inspect' : 'Drag to rotate · Sample history reveals every run'}</span></div>
        </div>
      </section>

      <section className="mobile-plate-detail" ref={detailRef} tabIndex={-1} aria-labelledby="mobile-plate-detail-title">
        <div className="mobile-plate-detail-topline">
          <button type="button" onClick={returnToPlate}><ArrowLeft size={15} aria-hidden="true" /> Back to plate</button>
          <span>{selectedSample?.sampleId ?? 'Empty well'}</span>
        </div>
        <div className="mobile-plate-detail-heading">
          <span className="mobile-plate-well-badge">{selectedWell ?? 'Plate'}</span>
          <div><span className="mobile-plate-eyebrow">{results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'} · ONE HISTORY</span><h2 id="mobile-plate-detail-title">{results.find((item) => item.seriesLabel)?.seriesLabel ?? selectedSample?.assay?.replace(/_/g, ' ').toUpperCase() ?? 'Plate control'}</h2></div>
        </div>
        <PlateHistorySource wellId={selectedWell} {...history} primary />
        {result ? <>
          <div className="mobile-plate-result-strip" role="group" aria-label={`Results for well ${selectedWell}`}>
            {results.map((item) => {
              const paint = paints.get(item.id)!;
              return <button type="button" key={item.id} aria-pressed={result.id === item.id} onClick={() => chooseResult(item)}
                ref={(node) => { if (node) resultRefs.current.set(item.id, node); else resultRefs.current.delete(item.id); }}
                aria-label={`${item.label}, ${item.title}, ${STATUS_LABEL[item.status]}${lens === 'status' ? '' : `, ${LENSES.find((option) => option.id === lens)?.label}: ${lensMeaning(item, lens, facts.get(item.id)!)}`}`}
                style={{ '--result-color': paint.base, '--result-shadow': shade(paint.base, -.65), '--result-glow': withAlpha(paint.base, .25) } as CSSProperties}>
                <span className="mobile-plate-result-disc" style={discStyle(paint)} aria-hidden="true"><b>{item.label}</b></span>
                <span className="mobile-plate-result-date">{dateLabel(item.runDate)}</span>
              </button>;
            })}
          </div>
          <div className="mobile-plate-result-nav">
            <button type="button" aria-label="Previous result" disabled={resultIndex <= 0} onClick={() => chooseResult(results[resultIndex - 1])}><ChevronLeft size={20} aria-hidden="true" /></button>
            <span>Result {resultIndex + 1} of {results.length} {lens === 'status' ? <span>· tap a disc to explore</span> : <small className="mobile-plate-lens-reading">{LENSES.find((option) => option.id === lens)?.label}: {lensMeaning(result, lens, facts.get(result.id)!)}</small>}</span>
            <button type="button" aria-label="Next result" disabled={resultIndex >= results.length - 1} onClick={() => chooseResult(results[resultIndex + 1])}><ChevronRight size={20} aria-hidden="true" /></button>
          </div>
          <CompactResultRecord sectionRequest={guide.request && guide.ownsRequest(guide.request.id) ? { id: guide.request.id, section: guide.request.step === 'resources' ? 'Files' : 'Why' } : undefined} result={result} stack={results} well={selectedSample ?? null} pinned={focus?.pinned ?? false} busy={history.phase === 'loading'} onSelect={(id) => sceneFocus({ resultId: id, pinned: true })} onTogglePin={() => focus && setFocus({ ...focus, pinned: !focus.pinned })} onClose={() => setFocus(null)} />
        </> : <><p className="mobile-plate-empty">{!selectedWell ? 'Choose a well to explore its results.' : results.length ? 'Record closed. Choose a well to continue.' : 'This well has no results. Choose another well to continue.'}</p>{selectedSample && <div className="plate-compact-record__body">{sampleVisible
          ? <WellDetail well={selectedSample} results={results} focusedResultId={null} upright={ui.upright} onSelectResult={(id) => sceneFocus({ resultId: id, pinned: true })} onClose={() => setSampleVisible(false)} />
          : <button type="button" onClick={() => setSampleVisible(true)}>Show sample details</button>}</div>}
        <TraySummary compact stats={stats} lens={lens} /></>}
      </section>
      <details className="mobile-plate-posture"><summary>Plate data posture</summary><TraySummary compact stats={stats} lens={lens} /></details>
      <label className="mobile-plate-environment">Environment<select aria-label="Plate environment" value={env.id} onChange={(event) => setEnv(event.target.value as EnvironmentId)}>{all.map((option) => <option key={option.id} value={option.id}>{option.longLabel}{option.writesEnabled ? '' : ' · read only'}</option>)}</select></label>
      <p className="mobile-plate-as-of">Demonstration data · storage as of {dateLabel(RESULTS_AS_OF)}, 2026</p>
    </div>
  );
}
