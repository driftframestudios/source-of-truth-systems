import type { LucideIcon } from 'lucide-react';
import {
  Activity, ShieldCheck, ShieldAlert, Lock, TrendingUp, Beaker, Dna,
  CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { STORE } from '../../data';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import { useQcReviews } from '../../services/qcReviewsContext';
import { GATE_REVIEW_ACTIONS, GATE_REVIEW_LABELS, gateReviewEvents } from '../../services/qcReviews';
import type { GateReview, GateReviewCommand } from '../../services/qcReviews';
import { getRole } from '../../services/accessService';
import type { QCMetric, QCGate, QCStatus, QCStage } from '../../types';

const RUN_SCOPE = 'Run NVSX-2026-118';

const STATUS_COLOR: Record<QCStatus, string> = {
  pass: 'var(--sot-status-success)',
  warn: 'var(--sot-status-warning)',
  fail: 'var(--sot-status-danger)',
  pending: 'var(--sot-shell-muted)',
};

const STATUS_LABEL: Record<QCStatus, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  pending: 'PENDING',
};

const STAGE_ORDER: ReadonlyArray<QCStage> = ['wet_lab', 'sequencing', 'secondary', 'sign_out'];

const STAGE_META: Record<QCStage, { label: string; sub: string; Icon: LucideIcon }> = {
  wet_lab: { label: 'Wet Lab', sub: 'Extraction · Library Prep', Icon: Beaker },
  sequencing: { label: 'Sequencing', sub: 'Cluster · Basecall · Demux', Icon: Activity },
  secondary: { label: 'Secondary Analysis', sub: 'Align · Variant QC', Icon: Dna },
  sign_out: { label: 'Result Sign-out', sub: 'Two-person review · Release', Icon: ShieldCheck },
};

function comparatorGlyph(c: QCMetric['comparator']): string {
  return c === 'gte' ? '≥' : '≤';
}

function StatusPill({ status }: { status: QCStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
      style={{ background: `color-mix(in srgb, ${color} 12.157%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 33.333%, transparent)` }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Sparkline({ trend, status }: { trend: ReadonlyArray<number>; status: QCStatus }) {
  const color = STATUS_COLOR[status];
  const w = 72;
  const h = 18;
  if (trend.length < 2) {
    return <svg width={w} height={h} className="flex-shrink-0" />;
  }
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const span = max - min || 1;
  const pad = 2;
  const points = trend
    .map((v, i) => {
      const x = pad + (i / (trend.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}

function MetricRow({ metric }: { metric: QCMetric }) {
  const color = STATUS_COLOR[metric.status];
  // Pass/fail bar: position value against threshold, clamped for display.
  const ratio = metric.threshold === 0 ? 1 : metric.value / metric.threshold;
  let fillPct: number;
  if (metric.comparator === 'gte') {
    fillPct = Math.max(0, Math.min(1, ratio)) * 100;
  } else {
    // lte — lower is better; invert so a comfortable margin reads full.
    fillPct = Math.max(0, Math.min(1, metric.threshold === 0 ? 0 : (metric.threshold - metric.value) / metric.threshold + 0.5)) * 100;
  }
  return (
    <div className="px-2.5 py-2 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02]">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--sot-shell-text)] flex-1 min-w-0 truncate">{metric.label}</span>
        <Sparkline trend={metric.trend} status={metric.status} />
        <StatusPill status={metric.status} />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[11px] font-mono" style={{ color }}>
          {metric.value}{metric.unit}
        </span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">
          spec {comparatorGlyph(metric.comparator)} {metric.threshold}{metric.unit}
        </span>
        <span className="ml-auto text-[8px] font-mono text-[var(--sot-shell-muted)]">{metric.id}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-[var(--sot-shell-text)]/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: color }} />
      </div>
    </div>
  );
}

function GateCard({ gate, review, commands, onAct }: { gate: QCGate; review: GateReview; commands: ReturnType<typeof useQcReviews>['commands']; onAct: (command: GateReviewCommand) => void }) {
  const color = STATUS_COLOR[gate.status];
  const metrics = gate.metricIds
    .map((id) => STORE.qcMetrics.find((m) => m.id === id))
    .filter((m): m is QCMetric => Boolean(m));
  const GateIcon = gate.status === 'fail' ? ShieldAlert : ShieldCheck;
  const halts = gate.blocking && gate.status === 'fail';
  const events = gateReviewEvents(gate, review);
  return (
    <div
      data-gate-id={gate.id}
      className="rounded border bg-[var(--sot-shell-surface)] overflow-hidden"
      style={{ borderColor: `color-mix(in srgb, ${color} 26.667%, transparent)` }}
    >
      {/* header */}
      <div className="px-3 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06]" style={{ background: `color-mix(in srgb, ${color} 6.275%, transparent)` }}>
        <div className="flex items-start gap-2">
          <div
            className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center mt-0.5"
            style={{ background: `color-mix(in srgb, ${color} 12.157%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 26.667%, transparent)` }}
          >
            <GateIcon size={14} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[var(--sot-shell-text)]">{gate.label}</span>
              {gate.blocking && (
                <span
                  className="text-[8px] font-mono px-1 py-0.5 rounded uppercase tracking-wider"
                  style={{ background: '#fb718522', color: 'var(--sot-status-danger)', border: '1px solid #fb718555' }}
                >
                  blocking
                </span>
              )}
              <StatusPill status={gate.status} />
            </div>
            <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-0.5 truncate">{gate.specimenScope}</div>
          </div>
        </div>
        <p className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed mt-1.5">{gate.description}</p>
        {halts && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-mono text-[var(--sot-status-danger)]">
            <AlertTriangle size={10} />
            Pipeline halted — downstream release is held pending disposition.
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[9px] font-mono text-[var(--sot-shell-muted)]">
          <span>owner: <span className="text-[var(--sot-shell-muted)]">{gate.owner}</span></span>
          <span>requires: <span className="text-[var(--sot-shell-muted)]">{getRole(gate.minWriteRole).label}</span></span>
        </div>
      </div>

      {/* metrics */}
      <div className="p-2.5 space-y-1.5">
        {metrics.map((m) => (
          <MetricRow key={m.id} metric={m} />
        ))}
      </div>

      <div className="px-2.5 pb-2.5">
        <p className="mb-2 text-[9px] font-mono" style={{ color: review === 'unreviewed' ? 'var(--sot-shell-muted)' : 'var(--sot-status-info)' }} role="status">{GATE_REVIEW_LABELS[review]}</p>
        <div className="flex gap-1.5 flex-wrap">
          {events.map(event => {
            const command = { id: gate.id, event };
            const canAct = commands.check(command).ok;
            return <button key={event} onClick={() => onAct(command)}
              className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-mono px-2 py-1.5 rounded border transition-colors"
              style={{ borderColor: canAct ? 'color-mix(in srgb, ' + color + ' 33.333%, transparent)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 14%, transparent)', color: canAct ? color : 'var(--sot-shell-muted)', background: canAct ? 'color-mix(in srgb, ' + color + ' 7.059%, transparent)' : 'transparent' }}>
              {!canAct && <Lock size={9} />}{GATE_REVIEW_ACTIONS[event].label}
            </button>;
          })}
        </div>
        {review === 'rerun_requested' && <p className="mt-1.5 text-[9px] text-[var(--sot-shell-muted)]">Repeat analysis requested in this session. The recorded metrics and release hold remain.</p>}
      </div>
    </div>
  );
}

export function QCView() {
  const { env } = useEnvironment();

  const writeGate = useWriteGate();

  const { reviews, commands } = useQcReviews();
  const reviewedCount = Object.values(reviews).filter(review => review !== 'unreviewed').length;
  const onAct = (command: GateReviewCommand) => {
    const result = commands.execute(command);
    if (!result.ok) writeGate.deny(GATE_REVIEW_ACTIONS[command.event].label, result, command.id);
  };

  const metrics = STORE.qcMetrics;
  const gates = STORE.qcGates;
  const canEdit = gates.some(gate => gateReviewEvents(gate, reviews[gate.id])
    .some(event => commands.check({ id: gate.id, event }).ok));

  const passCount = metrics.filter((m) => m.status === 'pass').length;
  const warnCount = metrics.filter((m) => m.status === 'warn').length;
  const failCount = metrics.filter((m) => m.status === 'fail').length;
  const blockingOpen = gates.filter((g) => g.blocking && (g.status === 'fail' || g.status === 'warn')).length;
  const runReady = gates.every((g) => !(g.blocking && g.status === 'fail'));

  const summary: ReadonlyArray<{ key: string; label: string; value: number | string; color: string; Icon: LucideIcon }> = [
    { key: 'pass', label: 'metrics passing', value: passCount, color: 'var(--sot-status-success)', Icon: CheckCircle2 },
    { key: 'warn', label: 'metrics warning', value: warnCount, color: 'var(--sot-status-warning)', Icon: AlertTriangle },
    { key: 'fail', label: 'metrics failing', value: failCount, color: 'var(--sot-status-danger)', Icon: XCircle },
    { key: 'block', label: 'blocking gates open', value: blockingOpen, color: blockingOpen > 0 ? 'var(--sot-status-danger)' : 'var(--sot-shell-muted)', Icon: ShieldAlert },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Top summary strip */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-background)]/80 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-sky-400" />
          <span className="text-[11px] font-medium text-[var(--sot-shell-text)]">Quality Control</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] px-1.5 py-0.5 rounded bg-[var(--sot-shell-text)]/[0.03] border border-[var(--sot-shell-strong-border)]/[0.06]">{RUN_SCOPE}</span>
        </div>
        <div className="w-px h-4 bg-[var(--sot-shell-text)]/10" />
        <div className="flex items-center gap-4">
          {summary.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <s.Icon size={12} style={{ color: s.color }} />
              <span className="text-[11px] font-mono" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[10px] text-[var(--sot-shell-muted)]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 text-[9px] font-mono px-2 py-1 rounded border"
            style={{
              borderColor: runReady ? '#34d39955' : '#fb718555',
              color: runReady ? 'var(--sot-status-success)' : 'var(--sot-status-danger)',
              background: runReady ? '#34d39912' : '#fb718512',
            }}
          >
            {runReady ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {runReady ? 'Run cleared for release review' : 'Run held — blocking gate failed'}
          </div>
          <div
            className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-1 rounded border"
            style={{
              borderColor: canEdit ? `color-mix(in srgb, ${env.accent} 33.333%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 15%, transparent)',
              color: canEdit ? env.accent : 'var(--sot-shell-muted)',
              background: canEdit ? `color-mix(in srgb, ${env.accent} 7.059%, transparent)` : 'transparent',
            }}
          >
            {!canEdit && <Lock size={9} />}
            {env.label} · {canEdit ? 'write' : 'read-only'}
          </div>
        </div>
      </div>

      {/* GxP context line */}
      <div className="flex items-center gap-2 px-5 py-1.5 border-b border-[var(--sot-shell-strong-border)]/[0.05] bg-[var(--sot-shell-surface)]/60 flex-shrink-0">
        <TrendingUp size={10} className="text-[var(--sot-shell-muted)]" />
        <span className="text-[9px] text-[var(--sot-shell-muted)] leading-relaxed">
          Record a response to each gate. Reviews stay in this session; measured failures keep release on hold.
          <span className="text-[var(--sot-status-info)] ml-1 font-mono">· {reviewedCount} of {gates.length} reviews recorded</span>
        </span>
      </div>

      {/* Stage rail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex gap-4 p-4 min-w-max">
          {STAGE_ORDER.map((stage, idx) => {
            const meta = STAGE_META[stage];
            const stageGates = gates.filter((g) => g.stage === stage);
            const stageMetrics = metrics.filter((m) => m.stage === stage);
            const hasFail = stageMetrics.some((m) => m.status === 'fail') || stageGates.some((g) => g.status === 'fail');
            const hasWarn = stageMetrics.some((m) => m.status === 'warn') || stageGates.some((g) => g.status === 'warn');
            const stageColor = hasFail ? 'var(--sot-status-danger)' : hasWarn ? 'var(--sot-status-warning)' : 'var(--sot-status-success)';
            return (
              <div key={stage} className="w-80 flex-shrink-0 flex flex-col">
                {/* stage header */}
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] w-4">{String(idx + 1).padStart(2, '0')}</span>
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${stageColor} 10.196%, transparent)`, border: `1px solid color-mix(in srgb, ${stageColor} 26.667%, transparent)` }}
                  >
                    <meta.Icon size={12} style={{ color: stageColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-[var(--sot-shell-text)] uppercase tracking-wider">{meta.label}</div>
                    <div className="text-[9px] text-[var(--sot-shell-muted)]">{meta.sub}</div>
                  </div>
                  {idx < STAGE_ORDER.length - 1 && (
                    <span className="text-[var(--sot-shell-muted)] text-[11px] flex-shrink-0">→</span>
                  )}
                </div>

                {/* gates in stage */}
                <div className="space-y-3">
                  {stageGates.map((gate) => (
                    <GateCard key={gate.id} gate={gate} review={reviews[gate.id]} commands={commands} onAct={onAct} />
                  ))}
                  {stageGates.length === 0 && (
                    <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] px-2 py-4 text-center rounded border border-dashed border-[var(--sot-shell-strong-border)]/[0.06]">
                      no gates defined for this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
