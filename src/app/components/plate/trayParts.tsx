import type { LucideIcon } from 'lucide-react';
// ============================================================
// Building blocks for the unfurled result record.
// ============================================================

import type { ReactNode } from 'react';
import { Ban, Check, Clock3, Minus, TriangleAlert } from 'lucide-react';
import type { ResultMetric, StorageClassId, WellResult } from '../../types';
import type { ResolvedArtifact, Verdict } from '../../services/dataAvailability';
import { STORAGE_CLASSES, formatHours } from '../../services/dataAvailability';
import { withAlpha } from './plateGeometry';
import { usePlateColors } from './usePlateColors';

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[8.5px] font-mono uppercase tracking-[0.14em] text-[var(--sot-shell-muted)]">{children}</span>
      {right}
    </div>
  );
}

export function Chip({ color, children, solid, title }: { color: string; children: ReactNode; solid?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 text-[8.5px] font-mono uppercase tracking-wider px-1.5 py-[2px] rounded-sm whitespace-nowrap"
      style={solid
        ? { backgroundColor: color, color: 'var(--sot-shell-on-accent)', fontWeight: 600 }
        : { color, backgroundColor: withAlpha(color, 0.12), border: `1px solid ${withAlpha(color, 0.35)}` }}
    >
      {children}
    </span>
  );
}

export const VERDICT_STYLE: Record<Verdict, { color: string; icon: LucideIcon; label: string }> = {
  yes: { color: '#34d399', icon: Check, label: 'yes' },
  wait: { color: '#f59e0b', icon: Clock3, label: 'wait' },
  caution: { color: '#fb923c', icon: TriangleAlert, label: 'caution' },
  no: { color: '#fb7185', icon: Ban, label: 'no' },
  na: { color: '#64748b', icon: Minus, label: 'n/a' },
};

function metricPass(m: ResultMetric): boolean | null {
  if (m.target == null || m.comparator == null) return null;
  return m.comparator === 'gte' ? m.value >= m.target : m.value <= m.target;
}

function fmtMetric(v: number, unit: string): string {
  const s = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 2 : 1);
  return unit === '×' ? `${s}×` : unit ? `${s} ${unit}` : s;
}

export function MetricRow({ metric, previous }: { metric: ResultMetric; previous?: ResultMetric }) {
  const { theme } = usePlateColors();
  const pass = metricPass(metric);
  const delta = previous ? metric.value - previous.value : null;
  const better = delta == null || metric.comparator == null ? null : metric.comparator === 'gte' ? delta > 0 : delta < 0;
  return (
    <div className="grid items-baseline gap-2 text-[10px] py-[3px] border-b border-[var(--sot-shell-border)]" style={{ gridTemplateColumns: '1fr auto auto' }}>
      <span className="text-[var(--sot-shell-muted)] truncate">{metric.label}</span>
      <span className="font-mono tabular-nums" style={{ color: pass == null ? theme.shell.text : pass ? theme.status.success : theme.status.danger }}>
        {previous && previous.value !== metric.value && (
          <span className="text-[var(--sot-shell-muted)] line-through mr-1">{fmtMetric(previous.value, metric.unit)}</span>
        )}
        {fmtMetric(metric.value, metric.unit)}
      </span>
      <span className="font-mono text-[9px] tabular-nums w-14 text-right" style={{ color: delta ? (better ? theme.status.success : theme.status.danger) : theme.shell.muted }}>
        {delta
          ? `${delta > 0 ? '+' : ''}${fmtMetric(Math.round(delta * 100) / 100, metric.unit === '%' ? 'pp' : metric.unit)}`
          : metric.target != null
          ? `${metric.comparator === 'lte' ? '≤' : '≥'}${fmtMetric(metric.target, metric.unit)}`
          : ''}
      </span>
    </div>
  );
}

function classPattern(cls: StorageClassId, color: string): string {
  if (cls === 'glacier_flexible') return `repeating-linear-gradient(60deg, rgba(255,255,255,0.25) 0 1px, transparent 1px 4px), ${color}`;
  if (cls === 'deep_archive') return `repeating-linear-gradient(60deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 3px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.25) 0 1px, transparent 1px 3px), ${color}`;
  if (cls === 'expired') return `repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 5px), ${color}`;
  return color;
}

function dayLabel(d: number): string {
  if (d === 0) return '0';
  if (d < 365) return `${d}d`;
  const y = d / 365;
  return `${Number.isInteger(y) ? y : y.toFixed(1)}y`;
}

/** Lifecycle rule timeline for one object: classes over age (sqrt scale), today marker, next transition. */
export function LifecycleTimeline({ resolved }: { resolved: ResolvedArtifact }) {
  const { color: ink } = usePlateColors();
  const { position, artifact, state } = resolved;
  const lastStart = Math.max(...position.segments.map((s) => s.fromDay));
  const maxDay = Math.max(lastStart * 1.3, position.ageDays * 1.35, 150);
  const sx = (d: number) => (Math.sqrt(Math.max(0, Math.min(d, maxDay))) / Math.sqrt(maxDay)) * 100;
  const today = sx(position.ageDays);
  const next = position.next;
  return (
    <div>
      <div className="relative pt-4">
        <div className="absolute text-[8px] font-mono text-[var(--sot-shell-text)] whitespace-nowrap -translate-x-1/2" style={{ left: `${today}%`, top: 0 }}>
          today · d{position.ageDays}
        </div>
        <div className="relative h-3.5 rounded-[3px]" style={{ background: 'rgba(148,163,200,0.06)' }}>
          {position.segments.map((s) => {
            const a = sx(s.fromDay);
            const b = sx(s.toDay ?? maxDay);
            const color = ink(STORAGE_CLASSES[s.storageClass].color);
            const elapsedEnd = Math.min(b, today);
            return (
              <div key={s.fromDay}>
                {elapsedEnd > a && (
                  <div className="absolute top-0 bottom-0" style={{ left: `${a}%`, width: `${elapsedEnd - a}%`, background: classPattern(s.storageClass, color) }} />
                )}
                {b > Math.max(a, today) && (
                  <div className="absolute top-0 bottom-0" style={{ left: `${Math.max(a, today)}%`, width: `${b - Math.max(a, today)}%`, background: classPattern(s.storageClass, color), opacity: 0.28 }} />
                )}
                <div className="absolute top-0 bottom-0 w-px bg-[var(--sot-shell-background)]" style={{ left: `${a}%` }} />
              </div>
            );
          })}
          <div className="absolute -top-1 -bottom-1 w-[2px] rounded bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ left: `calc(${today}% - 1px)` }} />
        </div>
        <div className="relative h-3 mt-0.5">
          {position.segments.filter((s) => s.fromDay > 0).map((s) => (
            <span key={s.fromDay} className="absolute text-[7.5px] font-mono text-[var(--sot-shell-muted)] -translate-x-1/2" style={{ left: `${sx(s.fromDay)}%` }}>
              {dayLabel(s.fromDay)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[9px] font-mono">
        <span style={{ color: ink(STORAGE_CLASSES[position.current].color) }}>● {STORAGE_CLASSES[position.current].short} since d{position.sinceDay}</span>
        {next && (
          <span className="text-[var(--sot-shell-secondary)]">
            → {STORAGE_CLASSES[next.storageClass].short} in <span className="text-[var(--sot-shell-text)]">{next.inDays}d</span>
          </span>
        )}
        {state === 'restoring' && artifact.restore?.readyAt && <span className="text-amber-300">restore {resolved.wait}</span>}
        {state === 'restored' && artifact.restore?.expiresAt && <span className="text-teal-300">restored copy until {artifact.restore.expiresAt}</span>}
      </div>
    </div>
  );
}

/** ctDNA trajectory across a tumor-informed series (log VAF), with the focused draw highlighted. */
export function CtDnaSparkline({ stack, focusedId }: { stack: ReadonlyArray<WellResult>; focusedId: string }) {
  const { theme } = usePlateColors();
  const pts = stack.filter((r) => r.ctDna).map((r) => ({ r, c: r.ctDna! }));
  if (pts.length < 2) return null;
  const W = 236;
  const H = 78;
  const pad = { l: 30, r: 10, t: 10, b: 14 };
  const t0 = Date.parse(pts[0].r.runDate);
  const t1 = Date.parse(pts[pts.length - 1].r.runDate);
  const floor = 0.005;
  const yMin = Math.log10(floor);
  const yMax = Math.log10(5);
  const X = (d: string) => pad.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - (Math.log10(Math.max(floor, v)) - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const line = pts.map(({ r, c }, i) => `${i ? 'L' : 'M'} ${X(r.runDate).toFixed(1)} ${Y(c.detected ? c.meanVafPct : floor).toFixed(1)}`).join(' ');
  const emerging = pts.find(({ c }) => c.emerging);
  return (
    <svg width={W} height={H} className="block" aria-label="ctDNA trajectory">
      {[1, 0.1, 0.01].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="rgba(148,163,200,0.1)" strokeDasharray="2 3" />
          <text x={pad.l - 4} y={Y(v) + 3} textAnchor="end" fontSize={7.5} fontFamily="JetBrains Mono, monospace" fill={theme.shell.muted}>{v}%</text>
        </g>
      ))}
      <text x={pad.l - 4} y={Y(floor) + 3} textAnchor="end" fontSize={7.5} fontFamily="JetBrains Mono, monospace" fill={theme.shell.muted}>ND</text>
      <path d={line} fill="none" stroke={theme.status.info} strokeWidth={1.2} strokeOpacity={0.85} />
      {pts.map(({ r, c }) => {
        const focused = r.id === focusedId;
        const cx = X(r.runDate);
        const cy = Y(c.detected ? c.meanVafPct : floor);
        return (
          <g key={r.id}>
            {focused && <circle cx={cx} cy={cy} r={6.5} fill="none" stroke={theme.shell.focus} strokeWidth={1} />}
            <circle cx={cx} cy={cy} r={focused ? 3.6 : 2.6} fill={c.detected ? (c.emerging ? theme.status.warning : theme.status.info) : theme.shell.surface} stroke={c.detected ? 'none' : theme.status.info} strokeWidth={1} />
            <text x={cx} y={H - 2} textAnchor="middle" fontSize={7.5} fontFamily="JetBrains Mono, monospace" fill={focused ? theme.shell.text : theme.shell.muted}>{r.label}</text>
          </g>
        );
      })}
      {emerging && (
        <text x={Math.min(W - pad.r, X(emerging.r.runDate) + 4)} y={Y(emerging.c.meanVafPct) - 7} textAnchor="end" fontSize={7.5} fontFamily="JetBrains Mono, monospace" fill={theme.status.warning}>
          {emerging.c.emerging?.split(' ').slice(0, 2).join(' ')}
        </text>
      )}
    </svg>
  );
}

export function hoursUntil(fromIso: string, toIso: string): string {
  return formatHours(Math.max(0, (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000));
}
