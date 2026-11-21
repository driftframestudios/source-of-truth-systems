// ============================================================
// Result tray — where a hovered disc's record unfurls.
//
// At rest it shows the plate's data posture. Selection reveals a
// record while the gossamer thread and hairline animate in parallel:
// why the result exists, whether
// its data is readable right now, and where it lives in the S3
// lifecycle / Athena query layer. Write actions (Glacier restores,
// partition repairs) execute through the canonical Plate command owner.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Variants } from 'motion/react';
import {
  Pin, PinOff, X, Lock, Copy, ArchiveRestore, DatabaseZap, Flag, GitBranch, ShieldAlert,
  ChevronRight, Snowflake, HardDrive,
} from 'lucide-react';
import type { ArtifactKind, Well, WellResult } from '../../types';
import type { ResolvedArtifact, RestoreOption } from '../../services/dataAvailability';
import {
  ARTIFACT_LABEL, ATHENA_LABEL, STORAGE_CLASSES,
  athenaPosture, availabilitySummary, formatBytes, formatUsd, readinessAnswers, readsArtifact,
  resolveResult, restoreCost, restoreWindow, stackPullPlan,
} from '../../services/dataAvailability';
import { PLATE_ID, RESULT_KIND_LABEL } from '../../data/wellResults';
import { useEnvironment } from '../../services/environment';
import { usePlateOverlay } from './plateOverlay';
import { overlayValue } from './plateOverlayState';
import type { PlateExampleCommand } from './plateCommands';
import { STATUS_LABEL, legendFor, discBackground } from './stackLens';
import { usePlateColors } from './usePlateColors';
import type { StackLens } from './stackLens';
import { PlateHistorySource } from './PlateHistorySource';
import type { PlateHistorySourceProps } from './PlateHistorySource';
import { CtDnaSparkline, Chip, LifecycleTimeline, MetricRow, SectionLabel, VERDICT_STYLE } from './trayParts';
import { withAlpha } from './plateGeometry';
import { WellDetail } from './WellPanels';
import type { PlatePostureStats } from './plateProjection';

export interface TrayGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}


export function ResultTray({
  geometry, landingX, result, stack, well, pinned, instant, lens, stats, historySource,
  onSelect, onTogglePin, onClose,
}: {
  geometry: TrayGeometry;
  landingX: number;
  result: WellResult | null;
  stack: ReadonlyArray<WellResult>;
  well: Well | null;
  pinned: boolean;
  instant: boolean;
  lens: StackLens;
  stats: PlatePostureStats;
  historySource?: PlateHistorySourceProps;
  onSelect: (resultId: string) => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const { theme } = usePlateColors();
  return (
    <motion.div data-scene-controls
      className="absolute rounded-lg border flex flex-col"
      data-result-tray
      style={{
        left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, zIndex: 24,
        background: theme.mode === 'dark' ? 'linear-gradient(180deg, rgba(11,18,33,0.95), rgba(7,12,22,0.97))' : `linear-gradient(180deg, ${theme.shell.surface}, ${theme.shell.inset})`,
        borderColor: theme.shell.border,
        boxShadow: theme.mode === 'light'
          ? `0 2px 5px ${withAlpha(theme.shell.text, 0.08)}, 0 10px 24px ${withAlpha(theme.shell.text, 0.1)}, inset 0 1px 0 ${theme.shell.surface}`
          : '0 -12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(6px)',
      }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: instant ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {historySource && <PlateHistorySource {...historySource} primary />}
      <div className="relative flex-1 min-h-0" aria-busy={historySource?.phase === 'loading'}>
        {result ? (
          <TrayRecord
            key={result.id}
            result={result}
            stack={stack}
            well={well}
            pinned={pinned}
            instant={instant}
            landingX={landingX - geometry.left}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
            onClose={onClose}
          />
        ) : (
          <TraySummary key="summary" stats={stats} lens={lens} />
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// At rest — plate data posture
// ---------------------------------------------------------------------------

function Kpi({ label, value, sub, color = 'var(--sot-shell-text)' }: { label: string; value: ReactNode; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-[var(--sot-shell-muted)] truncate">{label}</span>
      <span className="text-[20px] leading-none tabular-nums" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
      {sub && <span className="text-[9px] text-[var(--sot-shell-muted)] truncate">{sub}</span>}
    </div>
  );
}

export function TraySummary({ stats, lens, compact = false }: { stats: PlatePostureStats; lens: StackLens; compact?: boolean }) {
  const { theme, athenaInk: ATHENA_COLOR, color } = usePlateColors();
  const legend = legendFor(lens, theme.mode);
  return (
    <motion.div className={compact ? "plate-compact-summary p-4 flex flex-col gap-3" : "absolute inset-0 p-4 flex flex-col gap-3 overflow-hidden"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] text-[var(--sot-shell-text)]">Plate {PLATE_ID} · data posture</span>
        <span className="text-[10px] text-[var(--sot-shell-muted)]">{compact ? 'Choose a well, then tap a result to explore its history.' : 'Hover a disc and its record unfurls here · click to pin · ← → walk a history · ↑ ↓ rows · ⇧← → columns · Esc releases'}</span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <Kpi label="Results" value={stats.results} sub={`across ${stats.wells} wells`} />
        <Kpi label="Multi-result wells" value={stats.multiWells} sub="stacks taller than one" color="var(--sot-shell-selected-text)" />
        <Kpi label="Longitudinal series" value={stats.longitudinalSeries} sub="draws linked to an anchor" color="var(--sot-status-info)" />
        <Kpi label="Reruns & re-preps" value={stats.reruns} sub="top-ups, re-extractions" color="var(--sot-status-warning)" />
        <Kpi label="Reanalyses" value={stats.reanalyses} sub="same reads, new caller" color="var(--sot-status-violet)" />
      </div>
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1.4fr 1fr' }}>
        <div>
          <SectionLabel>Calls & QC readable now</SectionLabel>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-[var(--sot-shell-raised)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${stats.lightReadyPct}%`, background: 'linear-gradient(90deg, #2dd4bf, #34d399)' }} />
            </div>
            <span className="text-[11px] font-mono text-[var(--sot-shell-selected-text)] tabular-nums">{stats.lightReadyPct}%</span>
          </div>
          <div className="text-[9.5px] text-[var(--sot-shell-muted)] mt-1 leading-snug">VCFs, calls and QC are pinned hot by lifecycle rule — they never need a restore.</div>
        </div>
        <div>
          <SectionLabel>Reads files by storage class · {stats.readsFrozen} of {stats.readsTotal} need a restore</SectionLabel>
          <div className="flex h-2 rounded-full overflow-hidden bg-[var(--sot-shell-raised)]">
            {stats.readsByClass.map((c) => (
              <div key={c.key} title={`${c.label}: ${c.count}`} style={{ width: `${(c.count / Math.max(1, stats.readsTotal)) * 100}%`, background: color(c.color) }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {stats.readsByClass.map((c) => (
              <span key={c.key} className="text-[9px] font-mono flex items-center gap-1" style={{ color: c.frozen ? theme.status.violet : theme.shell.secondary }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color(c.color) }} />
                {c.label} <span className="text-[var(--sot-shell-muted)]">{c.count}</span>
              </span>
            ))}
          </div>
          {stats.freezingSoon > 0 && (
            <div className="text-[9.5px] text-amber-300/90 mt-1">
              {stats.freezingSoon} instantly readable BAM{stats.freezingSoon === 1 ? '' : 's'} freeze into Glacier within 21 days — grab them now if you need them.
            </div>
          )}
        </div>
        <div>
          <SectionLabel>Athena today</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {stats.athena.filter((a) => a.count > 0).map((a) => (
              <Chip key={a.state} color={ATHENA_COLOR[a.state]}>{ATHENA_LABEL[a.state]} · {a.count}</Chip>
            ))}
          </div>
          <div className="text-[9.5px] text-[var(--sot-shell-muted)] mt-1 leading-snug">Runs before 2025-07-01 need their partitions rebuilt before Athena can see them.</div>
        </div>
      </div>
      <div className="mt-auto pt-2 border-t border-[var(--sot-shell-border)] flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-[var(--sot-shell-muted)]">Lens · {lens === 'kind' ? 'why' : lens}</span>
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1 text-[9px] font-mono text-[var(--sot-shell-secondary)]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: discBackground({ base: l.color, pattern: l.pattern, mark: l.mark }),
                border: l.pattern === 'hollow' ? `1px dashed ${l.color}` : 'none',
                boxShadow: l.ring ? `0 0 0 1.5px ${l.ring}` : 'none',
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Unfurled record
// ---------------------------------------------------------------------------

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT_EXPO } },
};

function useResultRecord(result: WellResult, stack: ReadonlyArray<WellResult>) {
  const { env, maskValue } = useEnvironment();
  const overlay = usePlateOverlay();
  const resolved = useMemo(() => resolveResult(result), [result]);
  const athena = useMemo(() => athenaPosture(result, overlayValue(overlay.athena, result.id)), [result, overlay.athena]);
  const answers = useMemo(
    () => readinessAnswers(result, resolved, athena, env.infra.region, (id) => stack.find((r) => r.id === id)?.label ?? id),
    [result, resolved, athena, env.infra.region, stack],
  );
  const summary = useMemo(() => availabilitySummary(result, resolved), [result, resolved]);
  const predecessor = result.supersedes ? stack.find((r) => r.id === result.supersedes) : undefined;
  const successor = stack.find((r) => r.supersedes === result.id);
  return { maskValue, resolved, athena, answers, summary, predecessor, successor };
}

function TrayRecord({
  result, stack, well, pinned, instant, landingX, onSelect, onTogglePin, onClose,
}: {
  result: WellResult;
  stack: ReadonlyArray<WellResult>;
  well: Well | null;
  pinned: boolean;
  instant: boolean;
  landingX: number;
  onSelect: (resultId: string) => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const { statusInk: STATUS_COLOR, kind: KIND_COLOR, theme } = usePlateColors();
  const { maskValue, resolved, athena, answers, summary, predecessor, successor } = useResultRecord(result, stack);
  const accent = STATUS_COLOR[result.status];
  const sameWell = result.plateId === PLATE_ID && result.plateWell === result.wellId;

  return (
    <motion.div className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
      <motion.div
        aria-hidden
        className="absolute left-3 right-3 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent} 20%, #e2ecf8 50%, ${accent} 80%, transparent)`, transformOrigin: `${landingX - 12}px 50%` }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: instant ? 0 : 0.24, ease: EASE_OUT_EXPO }}
      />
      <motion.div
        className="absolute inset-0 flex flex-col"
        initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
        animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
        transition={{ duration: instant ? 0 : 0.24, ease: EASE_OUT_EXPO }}
      >
        <motion.div
          className="flex flex-col h-full min-h-0"
          initial={false}
          animate="show"
        >
          {/* header */}
          <motion.div variants={ITEM} className="px-4 pt-2.5 pb-2 border-b border-[var(--sot-shell-border)]">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-[10px] font-mono px-1.5 py-[1px] rounded-sm border border-[var(--sot-shell-border)] text-[var(--sot-shell-secondary)] flex-shrink-0">{result.wellId}</span>
              <span className="text-[15px] leading-none text-[var(--sot-shell-text)] flex-shrink-0" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{result.label}</span>
              <span className="text-[13px] text-[var(--sot-shell-text)] truncate min-w-0 flex-1 basis-32">{result.title}</span>
              <span className="flex items-center gap-1.5 flex-wrap">
                <Chip color={KIND_COLOR[result.kind]}>{RESULT_KIND_LABEL[result.kind]}</Chip>
                <Chip color={accent} solid={result.status === 'reportable'}>{STATUS_LABEL[result.status]}</Chip>
                <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{result.runDate}</span>
              </span>
              <span className="flex-1" />
              <button
                onClick={onTogglePin}
                className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-1 rounded border transition-colors flex-shrink-0"
                style={pinned
                  ? { color: theme.shell.surface, background: theme.shell.text, borderColor: theme.shell.text }
                  : { color: 'var(--sot-shell-secondary)', borderColor: 'var(--sot-shell-border)' }}
                aria-pressed={pinned}
                title={pinned ? 'Unpin — hover follows the cursor again' : 'Pin this record — hovering other discs will not replace it'}
              >
                {pinned ? <PinOff size={10} /> : <Pin size={10} />} {pinned ? 'pinned' : 'pin'}
              </button>
              <button onClick={onClose} className="p-1 text-[10px] leading-none rounded text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)] hover:bg-[var(--sot-shell-raised)] flex-shrink-0" aria-label="Close record">
                <X size={12} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1.5 min-w-0">
              <div className="flex items-center gap-1.5 text-[9.5px] font-mono text-[var(--sot-shell-muted)] min-w-0 flex-1 overflow-hidden whitespace-nowrap">
                {result.seriesLabel && (
                  <span className="px-1 rounded-sm flex-shrink-0" style={{ color: 'var(--sot-status-info)', background: 'rgba(147,197,253,0.08)' }}>{result.seriesLabel}</span>
                )}
                <span className="text-[var(--sot-shell-secondary)] flex-shrink-0">{result.plateId} · {result.plateWell}</span>
                <span className="px-1 rounded-sm flex-shrink-0" style={{ color: sameWell ? theme.shell.selectedText : theme.status.info, background: sameWell ? 'rgba(45,212,191,0.1)' : 'rgba(147,197,253,0.08)' }}>
                  {sameWell ? 'ran in this well' : `linked to anchor ${result.wellId}`}
                </span>
                <span className="truncate">
                  {[result.flowCell && `FC ${result.flowCell}`, result.pipeline, result.specimenType, result.patientCode && maskValue(result.patientCode), result.specimenId]
                    .filter(Boolean).join(' · ')}
                </span>
              </div>
              <StackRibbon stack={stack} focusedId={result.id} onSelect={onSelect} />
            </div>
          </motion.div>

          {/* summary sentence */}
          <motion.div variants={ITEM} className="px-4 py-1.5 text-[11px] text-[var(--sot-shell-text)] border-b border-[var(--sot-shell-border)] flex items-center gap-2">
            <HardDrive size={11} className="text-[var(--sot-shell-muted)] flex-shrink-0" />
            <span className="truncate">{summary}</span>
            {well?.consentStatus === 'rescinded' && <Chip color="#fb7185"><ShieldAlert size={9} /> consent rescinded</Chip>}
          </motion.div>

          <div className="grid flex-1 min-h-0" style={{ gridTemplateColumns: '1.05fr 1.15fr 1fr' }}>
            <motion.div variants={ITEM} className="min-h-0 overflow-y-auto px-4 py-2.5 border-r border-[var(--sot-shell-border)]">
              <WhyColumn result={result} stack={stack} predecessor={predecessor} successor={successor} onSelect={onSelect} />
            </motion.div>
            <motion.div variants={ITEM} className="min-h-0 overflow-y-auto px-4 py-2.5 border-r border-[var(--sot-shell-border)]">
              <ReadyColumn result={result} stack={stack} resolved={resolved} answers={answers} />
            </motion.div>
            <motion.div variants={ITEM} className="min-h-0 overflow-y-auto px-4 py-2.5">
              <WhereColumn result={result} resolved={resolved} athena={athena} />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function StackRibbon({ stack, focusedId, onSelect }: { stack: ReadonlyArray<WellResult>; focusedId: string; onSelect: (id: string) => void }) {
  const { statusInk: STATUS_COLOR } = usePlateColors();
  if (stack.length < 2) return null;
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="tablist" aria-label="Results in this well">
      {stack.map((r, i) => {
        const on = r.id === focusedId;
        return (
          <div key={r.id} className="flex items-center">
            {i > 0 && <span className="w-1.5 h-px bg-[var(--sot-shell-raised)]" />}
            <button
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(r.id)}
              title={`${r.label} · ${r.title} · ${STATUS_LABEL[r.status]}`}
              className="text-[9px] leading-none font-mono px-1.5 py-[3px] rounded-full border transition-colors"
              style={on
                ? { color: 'var(--sot-shell-on-accent)', background: STATUS_COLOR[r.status], borderColor: STATUS_COLOR[r.status] }
                : { color: STATUS_COLOR[r.status], borderColor: withAlpha(STATUS_COLOR[r.status], 0.35), background: 'transparent' }}
            >
              {r.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function WhyColumn({
  result, stack, predecessor, successor, onSelect,
}: {
  result: WellResult;
  stack: ReadonlyArray<WellResult>;
  predecessor?: WellResult;
  successor?: WellResult;
  onSelect: (id: string) => void;
}) {
  const compareTo = predecessor ?? (result.ctDna ? [...stack].reverse().find((r) => r.seq < result.seq && r.ctDna) : undefined);
  return (
    <>
      <SectionLabel>Why this result exists</SectionLabel>
      <p className="text-[11px] leading-[1.48] text-[var(--sot-shell-text)]">{result.reason}</p>
      {result.trigger && (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] rounded px-2 py-1.5" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)' }}>
          <Flag size={10} className="text-amber-400 mt-[2px] flex-shrink-0" />
          <span className="text-[var(--sot-status-warning)]">
            <span className="font-mono text-amber-300">{result.trigger.source}{result.trigger.refId ? ` · ${result.trigger.refId.replace(/^RES-/, '')}` : ''}</span>
            <span className="text-[var(--sot-status-warning)]"> — {result.trigger.detail}</span>
          </span>
        </div>
      )}
      {(predecessor || successor) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[9.5px] font-mono text-[var(--sot-shell-muted)]">
          <GitBranch size={10} />
          {predecessor && (
            <button onClick={() => onSelect(predecessor.id)} className="text-[9.5px] font-mono text-[var(--sot-shell-secondary)] hover:text-white underline decoration-dotted underline-offset-2">
              replaces {predecessor.label}
            </button>
          )}
          {predecessor && successor && <span>·</span>}
          {successor && (
            <button onClick={() => onSelect(successor.id)} className="text-[9.5px] font-mono text-[var(--sot-shell-secondary)] hover:text-white underline decoration-dotted underline-offset-2">
              replaced by {successor.label}
            </button>
          )}
        </div>
      )}
      {result.finding && (
        <div className="mt-2 text-[10.5px] rounded px-2 py-1.5 text-[var(--sot-shell-text)]" style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)' }}>
          {result.finding}
        </div>
      )}
      {stack.some((r) => r.ctDna) && (
        <div className="mt-2.5">
          <SectionLabel>ctDNA trajectory · mean VAF</SectionLabel>
          <CtDnaSparkline stack={stack} focusedId={result.id} />
        </div>
      )}
      {result.metrics.length > 0 && (
        <div className="mt-2.5">
          <SectionLabel right={compareTo ? <span className="text-[8.5px] font-mono text-[var(--sot-shell-muted)]">vs {compareTo.label}</span> : undefined}>Metrics</SectionLabel>
          {result.metrics.map((m) => (
            <MetricRow key={m.key} metric={m} previous={compareTo?.metrics.find((p) => p.key === m.key)} />
          ))}
        </div>
      )}
    </>
  );
}

function ReadyColumn({
  result, stack, resolved, answers,
}: {
  result: WellResult;
  stack: ReadonlyArray<WellResult>;
  resolved: ReadonlyArray<ResolvedArtifact>;
  answers: ReturnType<typeof readinessAnswers>;
}) {
  const { theme, color } = usePlateColors();
  const { env } = useEnvironment();
  const overlay = usePlateOverlay();
  const [restoreFor, setRestoreFor] = useState<ArtifactKind | null>(null);
  const target = { plateId: PLATE_ID, wellId: result.wellId, resultId: result.id };
  const bucket = env.infra.s3Buckets.find((b) => b.includes('streams')) ?? env.infra.s3Buckets[0];
  const plan = useMemo(() => stackPullPlan(stack), [stack]);

  const restore = async (kind: ArtifactKind, option: RestoreOption) => {
    const outcome = await overlay.execute({ type: 'artifact.restore', target, artifactKind: kind, tier: option.tier });
    if (outcome.ok) setRestoreFor(null);
  };

  return (
    <>
      <SectionLabel>Is the data ready?</SectionLabel>
      <div className="space-y-1.5">
        {answers.map((a) => {
          const verdict = VERDICT_STYLE[a.verdict];
          const v = { ...verdict, color: a.verdict === 'na' ? theme.shell.muted : color(verdict.color) };
          const Icon = v.icon;
          return (
            <div key={a.id} className="rounded px-2 py-1.5" style={{ background: withAlpha(v.color, 0.06), border: `1px solid ${withAlpha(v.color, 0.2)}` }}>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: withAlpha(v.color, 0.18), color: v.color }} aria-label={v.label}>
                  <Icon size={9} />
                </span>
                <span className="text-[9.5px] text-[var(--sot-shell-secondary)] flex-1 truncate">{a.question}</span>
              </div>
              <div className="pl-[22px] mt-0.5">
                <div className="text-[11px] font-mono" style={{ color: v.color }}>{a.headline}</div>
                <div className="text-[10px] leading-snug text-[var(--sot-shell-secondary)] mt-0.5">{a.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {plan && (
        <div className="mt-1.5 rounded px-2 py-1.5" style={{ background: 'rgba(147,197,253,0.05)', border: '1px solid rgba(147,197,253,0.18)' }}>
          <div className="text-[9.5px] text-[var(--sot-shell-secondary)]">{stack.some(item => item.artifactsRestricted) ? 'What if I pull the visible BAMs in this stack?' : 'What if I pull every BAM in this stack?'}</div>
          <div className="text-[11px] font-mono text-[var(--sot-status-info)] mt-0.5">
            {plan.files} BAM{plan.files === 1 ? '' : 's'} · {formatBytes(plan.totalBytes)} · ≈ {plan.download} at 1 Gbps
          </div>
          <div className="text-[10px] leading-snug text-[var(--sot-shell-secondary)] mt-0.5">
            {plan.readyNow} readable now
            {plan.frozen > 0 && <> · {plan.frozen} frozen — Standard restore {plan.restoreWindow}, ≈ {formatUsd(plan.restoreUsd)}</>}
            {plan.restoring > 0 && <> · {plan.restoring} already restoring</>}
            {plan.withheld > 0 && <> · {plan.withheld} withheld by consent</>}
            . Shared objects are counted once.
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-2.5">
          <SectionLabel right={<span className="text-[8.5px] font-mono text-[var(--sot-shell-muted)]">{bucket}</span>}>Files</SectionLabel>
          <div className="space-y-px">
            {resolved.map((r) => {
              const f = r.facts;
              const frozen = r.state === 'archived';
              const open = restoreFor === r.artifact.kind;
              const access = overlay.preview({ type: 'artifact.restore', target, artifactKind: r.artifact.kind, tier: r.options[0]?.tier ?? 'standard' });
              const copyAccess = overlay.preview({ type: 'artifact.copyUri', target, artifactKind: r.artifact.kind });
              const localTask = overlayValue(overlay.restores, r.artifact.key);
              return (
                <div key={r.artifact.kind}>
                  <div className="grid items-center gap-1.5 text-[10px] py-[3px] px-1 rounded hover:bg-[var(--sot-shell-raised)]" style={{ gridTemplateColumns: '5.2rem 3.8rem 1fr auto' }}>
                    <span className="text-[var(--sot-shell-text)] truncate" title={r.artifact.reusedFrom ? `Shared object from ${r.artifact.reusedFrom}` : undefined}>
                      {ARTIFACT_LABEL[r.artifact.kind]}{r.artifact.reusedFrom ? <span className="text-[var(--sot-shell-muted)]"> ↺</span> : null}
                    </span>
                    <span className="font-mono text-[var(--sot-shell-secondary)] tabular-nums text-right">{formatBytes(r.artifact.sizeBytes)}</span>
                    <span className="flex items-center gap-1 min-w-0 font-mono text-[9px]" title={`${f.label} — ${f.metaphor}`}>
                      {frozen || r.position.current === 'deep_archive' ? <Snowflake size={9} style={{ color: color(f.color) }} className="flex-shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color(f.color) }} />}
                      <span className="truncate" style={{ color: color(f.color) }}>{f.short}</span>
                      <span className="truncate" style={{ color: r.readNow ? 'var(--sot-status-success)' : r.state === 'held' ? 'var(--sot-status-danger)' : 'var(--sot-status-warning)' }}>· {r.wait}</span>
                      {r.artifact.legalHold && <Lock size={8} className="text-rose-300 flex-shrink-0" />}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {frozen && (
                        <button
                          onClick={() => setRestoreFor(open ? null : r.artifact.kind)}
                          className="flex items-center gap-0.5 text-[8.5px] font-mono px-1 py-[1px] rounded border"
                          style={access.ok
                            ? { color: 'var(--sot-status-violet)', borderColor: 'rgba(196,181,253,0.35)' }
                            : { color: 'var(--sot-shell-muted)', borderColor: 'var(--sot-shell-border)' }}
                          title={access.ok ? 'Choose a restore tier' : access.reason}
                          aria-expanded={open}
                        >
                          {access.ok ? <ArchiveRestore size={9} /> : <Lock size={8} />} restore
                        </button>
                      )}
                      {r.state !== 'held' && (
                        <button onClick={() => overlay.execute({ type: 'artifact.copyUri', target, artifactKind: r.artifact.kind })} aria-disabled={!copyAccess.ok} className="p-0.5 text-[9px] leading-none text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]" aria-label={`Copy S3 URI for ${ARTIFACT_LABEL[r.artifact.kind]}`} title={copyAccess.ok ? `Copy s3://${bucket}/${r.artifact.key}` : copyAccess.reason}>
                          <Copy size={9} />
                        </button>
                      )}
                    </span>
                  </div>
                  {localTask && r.state !== 'held' && <ExampleTaskControls label={`${ARTIFACT_LABEL[r.artifact.kind]} restore`}
                    running={localTask.state === 'in_progress'}
                    complete={{ type: 'artifact.complete', target, artifactKind: r.artifact.kind, generation: localTask.generation }}
                    replay={{ type: 'artifact.replay', target, artifactKind: r.artifact.kind, generation: localTask.generation }} />}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-1 my-1 p-1.5 rounded border border-violet-400/20 bg-violet-400/[0.04] space-y-1">
                          {r.options.map((o) => (
                            <button
                              key={o.tier}
                              onClick={() => restore(r.artifact.kind, o)}
                              className="w-full grid items-center gap-2 text-left text-[9.5px] font-mono px-1.5 py-1 rounded hover:bg-[var(--sot-shell-raised)]"
                              style={{ gridTemplateColumns: '4.5rem 4.5rem 1fr' }}
                            >
                              <span className="text-[var(--sot-shell-text)]">{o.label}</span>
                              <span className="text-[var(--sot-status-warning)]">{restoreWindow(o)}</span>
                              <span className="text-[var(--sot-shell-secondary)] text-right">{formatUsd(restoreCost(o, r.artifact.sizeBytes))}</span>
                              {o.caveat && <span className="col-span-3 text-[8.5px] text-[var(--sot-shell-muted)] leading-snug">{o.caveat}</span>}
                            </button>
                          ))}
                          <div className="text-[8.5px] text-[var(--sot-shell-muted)] px-1.5">A restored copy stays readable for 7 days; the original never leaves {r.facts.short}.</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function ExampleTaskControls({ label, running, complete, replay }: {
  label: string;
  running: boolean;
  complete: PlateExampleCommand;
  replay: PlateExampleCommand;
}) {
  const overlay = usePlateOverlay();
  return <div className="flex flex-wrap items-center gap-2 py-1 text-[9px] font-mono text-[var(--sot-shell-secondary)]">
    <span>Local example · this session</span>
    {(running ? [{ command: complete, text: 'Complete example' }, { command: replay, text: 'Replay' }] : [{ command: replay, text: 'Replay' }]).map(({ command, text }) => {
      const access = overlay.preview(command);
      return <button key={text} aria-label={`${text} · ${label}`} aria-disabled={!access.ok}
        title={access.ok ? (text === 'Replay' ? 'Return this local task to its starting state' : 'Show the completed local result now') : access.reason}
        onClick={() => void overlay.execute(command)}
        className="rounded border border-[var(--sot-shell-border)] px-1.5 py-0.5 text-[var(--sot-shell-text)] hover:bg-[var(--sot-shell-raised)] aria-disabled:opacity-50">
        {text}
      </button>;
    })}
  </div>;
}

function WhereColumn({
  result, resolved, athena,
}: {
  result: WellResult;
  resolved: ReadonlyArray<ResolvedArtifact>;
  athena: ReturnType<typeof athenaPosture>;
}) {
  const { athenaInk: ATHENA_COLOR, color } = usePlateColors();
  const { env } = useEnvironment();
  const overlay = usePlateOverlay();
  const reads = readsArtifact(resolved);
  const [kind, setKind] = useState<ArtifactKind | null>(reads?.artifact.kind ?? resolved[0]?.artifact.kind ?? null);
  const [showSql, setShowSql] = useState(false);
  const selected = resolved.find((r) => r.artifact.kind === kind) ?? reads ?? resolved[0];
  const target = { plateId: PLATE_ID, wellId: result.wellId, resultId: result.id };
  const commandType = athena.action?.kind === 'rebuild' ? 'query.rebuild' : 'query.repair';
  const access = overlay.preview({ type: commandType, target });
  const localTask = overlayValue(overlay.athena, result.id);

  const runFix = () => {
    if (!athena.action) return;
    void overlay.execute({ type: commandType, target });
  };

  return (
    <>
      <SectionLabel>Where it lives · lifecycle</SectionLabel>
      {selected ? (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            {resolved.map((r) => (
              <button
                key={r.artifact.kind}
                onClick={() => setKind(r.artifact.kind)}
                className="text-[8.5px] font-mono px-1.5 py-[2px] rounded-sm border"
                style={r.artifact.kind === selected.artifact.kind
                  ? { color: 'var(--sot-shell-on-accent)', background: color(r.facts.color), borderColor: color(r.facts.color) }
                  : { color: 'var(--sot-shell-secondary)', borderColor: 'var(--sot-shell-border)' }}
              >
                {ARTIFACT_LABEL[r.artifact.kind].split(' ')[0]}
              </button>
            ))}
          </div>
          <LifecycleTimeline resolved={selected} />
          <div className="mt-1.5 text-[10px] leading-snug text-[var(--sot-shell-secondary)]">
            <span className="font-mono text-[var(--sot-shell-muted)]">{selected.position.rule.id}</span> — {selected.position.rule.summary}
          </div>
          <div className="mt-1 text-[9.5px] italic text-[var(--sot-shell-muted)]">{STORAGE_CLASSES[selected.position.current].metaphor}</div>
        </>
      ) : (
        <div className="text-[10px] text-[var(--sot-shell-muted)]">{result.artifactsRestricted ? 'File lifecycle details are outside this scope.' : 'No files yet — lifecycle starts when the first object lands.'}</div>
      )}

      <div className="mt-3 rounded p-2" style={{ background: withAlpha(ATHENA_COLOR[athena.state], 0.06), border: `1px solid ${withAlpha(ATHENA_COLOR[athena.state], 0.25)}` }}>
        <div className="flex items-center gap-1.5">
          <DatabaseZap size={11} className="flex-shrink-0" style={{ color: ATHENA_COLOR[athena.state] }} />
          <span className="text-[10.5px] font-mono" style={{ color: ATHENA_COLOR[athena.state] }}>{athena.headline}</span>
        </div>
        <div className="text-[8.5px] font-mono text-[var(--sot-shell-muted)] mt-0.5 pl-[17px]">{athena.table}</div>
        <div className="text-[10px] leading-snug text-[var(--sot-shell-secondary)] mt-1">{athena.explanation}</div>
        {athena.silentRisk && (
          <div className="flex items-center gap-1 mt-1 text-[9.5px] text-amber-300">
            <ShieldAlert size={10} /> {athena.silentRisk}
          </div>
        )}
        {athena.scan && <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">{athena.scan} per query</div>}
        {athena.action && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={runFix}
              disabled={athena.running}
              className="flex items-center gap-1 text-[9.5px] font-mono px-2 py-1 rounded border transition-colors disabled:cursor-progress"
              style={athena.running
                ? { color: 'var(--sot-status-warning)', borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }
                : access.ok
                ? { color: 'var(--sot-shell-on-accent)', background: ATHENA_COLOR[athena.state], borderColor: ATHENA_COLOR[athena.state] }
                : { color: 'var(--sot-shell-muted)', borderColor: 'var(--sot-shell-border)' }}
              title={access.ok ? athena.action.sql : access.reason}
            >
              {athena.running ? <span className="w-2 h-2 rounded-full border border-amber-300 border-t-transparent animate-spin" /> : access.ok ? <ChevronRight size={10} /> : <Lock size={9} />}
              {athena.running ? 'running' : athena.action.label}
            </button>
            <span className="text-[9px] font-mono text-[var(--sot-shell-secondary)]">{athena.action.eta}</span>
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">· {athena.action.cost}</span>
            <button onClick={() => setShowSql((s) => !s)} className="ml-auto text-[8.5px] font-mono text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]">{showSql ? 'hide' : 'show'} SQL</button>
          </div>
        )}
        {localTask && (athena.state === 'ready' || athena.state === 'repair' || athena.state === 'rebuild') && <ExampleTaskControls label="query recovery"
          running={localTask.state === 'running'}
          complete={{ type: 'query.complete', target, generation: localTask.generation }}
          replay={{ type: 'query.replay', target, generation: localTask.generation }} />}
        {showSql && athena.action && (
          <pre className="mt-1.5 text-[9px] leading-snug font-mono text-[var(--sot-shell-text)] bg-black/30 rounded p-1.5 whitespace-pre-wrap">{athena.action.sql}</pre>
        )}
      </div>

      <div className="mt-2.5 space-y-0.5 text-[9px] font-mono text-[var(--sot-shell-muted)]">
        <div className="flex justify-between gap-2"><span>region</span><span className="text-[var(--sot-shell-secondary)]">{env.infra.region}</span></div>
        <div className="flex justify-between gap-2"><span>kms</span><span className="text-[var(--sot-shell-secondary)]">{env.infra.kmsAlias}</span></div>
        <div className="flex justify-between gap-2"><span>environment</span><span style={{ color: color(env.accent) }}>{env.label} · {env.writesEnabled ? 'writes on' : 'read-only'}</span></div>
        {resolved.some((r) => r.artifact.legalHold) && (
          <div className="flex justify-between gap-2"><span>object lock</span><span className="text-rose-300">legal hold · purge review</span></div>
        )}
      </div>
    </>
  );
}


const RECORD_SECTIONS = ['Why', 'Files', 'Lifecycle', 'Sample'] as const;
/** Touch presentation of the same record columns, policies and actions as the desktop tray. */
export function CompactResultRecord({ result, stack, well, pinned, busy = false, onSelect, onTogglePin, onClose, sectionRequest }: {
  sectionRequest?: { id: number; section: 'Why' | 'Files' };
  busy?: boolean;
  result: WellResult;
  stack: ReadonlyArray<WellResult>;
  well: Well | null;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const { statusInk: STATUS_COLOR } = usePlateColors();
  const [section, setSection] = useState<(typeof RECORD_SECTIONS)[number]>('Why');
  useEffect(() => { if (sectionRequest) setSection(sectionRequest.section); }, [sectionRequest?.id, sectionRequest?.section]);
  const { resolved, athena, answers, summary, predecessor, successor, maskValue } = useResultRecord(result, stack);
  return <article className="plate-compact-record" data-scene-controls aria-busy={busy} aria-label={`Result ${result.label} in well ${result.wellId}`}>
    <header>
      <div className="plate-compact-record__rail">
        <span className="mobile-plate-well-badge">{result.wellId} · {result.label}</span>
        <Chip color={STATUS_COLOR[result.status]}>{STATUS_LABEL[result.status]}</Chip>
        <button type="button" aria-pressed={pinned} onClick={onTogglePin} aria-label={pinned ? 'Unpin record' : 'Pin record'}>{pinned ? <PinOff size={17} /> : <Pin size={17} />}</button>
        <button type="button" onClick={onClose} aria-label="Close record"><X size={18} /></button>
      </div>
      <h3>{result.title}</h3>
      <p>{result.runDate} · {RESULT_KIND_LABEL[result.kind]}</p>
      <StackRibbon stack={stack} focusedId={result.id} onSelect={onSelect} />
      <p className="plate-compact-record__summary">{summary}</p>
    </header>
    <nav className="plate-compact-record__tabs" aria-label="Result detail sections">
      {RECORD_SECTIONS.map((name) => <button key={name} type="button" aria-pressed={section === name} onClick={() => setSection(name)}>{name}</button>)}
    </nav>
    <div className="plate-compact-record__body">
      {section === 'Why' && <><WhyColumn result={result} stack={stack} predecessor={predecessor} successor={successor} onSelect={onSelect} />
        <details className="mobile-plate-provenance"><summary>Run provenance</summary><dl>
          <div><dt>Plate / well</dt><dd>{result.plateId} / {result.plateWell}</dd></div>
          <div><dt>Pipeline</dt><dd>{result.pipeline}</dd></div>
          {result.flowCell && <div><dt>Flow cell</dt><dd>{result.flowCell}</dd></div>}
          <div><dt>Specimen</dt><dd>{result.specimenType} · {result.specimenId ?? '—'}</dd></div>
          <div><dt>Patient</dt><dd>{maskValue(result.patientCode)}</dd></div>
        </dl></details>
      </>}
      {section === 'Files' && <ReadyColumn key={result.id} result={result} stack={stack} resolved={resolved} answers={answers} />}
      {section === 'Lifecycle' && <WhereColumn key={result.id} result={result} resolved={resolved} athena={athena} />}
      {section === 'Sample' && (well ? <WellDetail well={well} results={stack} focusedResultId={result.id} upright onSelectResult={onSelect} onClose={() => setSection('Why')} /> : <p>No sample in this well.</p>)}
    </div>
  </article>;
}
