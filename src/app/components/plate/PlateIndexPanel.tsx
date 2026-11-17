import type { LucideIcon } from 'lucide-react';
// ============================================================
// Left rail for the plate scene: an index of every well whose
// stack is taller than one, grouped by the story it tells, plus
// the S3 lifecycle policies that decide where each file lives.
// ============================================================

import { useMemo } from 'react';
import { Activity, Repeat, RefreshCcw, ShieldAlert, Snowflake, ChevronRight } from 'lucide-react';
import type { LifecycleRule, WellResult } from '../../types';
import { RESULT_KIND_LABEL } from '../../data/wellResults';
import { STORAGE_CLASSES } from '../../services/dataAvailability';
import { STATUS_LABEL } from './stackLens';
import { usePlateColors } from './usePlateColors';
import { withAlpha } from './plateGeometry';

type IconType = LucideIcon;

interface StoryRow {
  readonly wellId: string;
  readonly title: string;
  readonly sub: string;
  readonly results: ReadonlyArray<WellResult>;
}

interface StoryGroup {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly icon: IconType;
  readonly color: string;
  readonly rows: ReadonlyArray<StoryRow>;
}

function wellOrder(a: string, b: string): number {
  return a[0] === b[0] ? Number(a.slice(1)) - Number(b.slice(1)) : a.localeCompare(b);
}

function storyTitle(list: ReadonlyArray<WellResult>): string {
  const series = list.find((r) => r.seriesLabel)?.seriesLabel;
  if (series) return series;
  const extra = list.slice(1).map((r) => RESULT_KIND_LABEL[r.kind].toLowerCase());
  const failed = list.find((r) => r.status === 'failed_qc');
  return failed?.trigger ? `${failed.trigger.detail} → ${extra.join(', ')}` : `${RESULT_KIND_LABEL[list[0].kind]} → ${extra.join(', ')}`;
}

function storySub(list: ReadonlyArray<WellResult>): string {
  const last = list[list.length - 1];
  return `${list.length} results · ${last.label} ${STATUS_LABEL[last.status].toLowerCase()}`;
}

export function PlateIndexPanel({
  stacks, rules, focusWellId, upright, onOpen, compact = false,
}: {
  compact?: boolean;
  stacks: ReadonlyMap<string, ReadonlyArray<WellResult>>;
  rules: ReadonlyArray<LifecycleRule>;
  focusWellId: string | null;
  upright: boolean;
  onOpen: (wellId: string) => void;
}) {
  const { status: STATUS_COLOR, color } = usePlateColors();
  const groups = useMemo<ReadonlyArray<StoryGroup>>(() => {
    const used = new Set<string>();
    const pick = (test: (l: ReadonlyArray<WellResult>) => boolean): StoryRow[] =>
      [...stacks.entries()]
        .filter(([wid, l]) => l.length > 1 && !used.has(wid) && test(l))
        .sort(([a], [b]) => wellOrder(a, b))
        .map(([wid, l]) => { used.add(wid); return { wellId: wid, title: storyTitle(l), sub: storySub(l), results: l }; });
    const held = pick((l) => l.some((r) => r.status === 'held' || r.status === 'cancelled'));
    const longitudinal = pick((l) => l.some((r) => r.kind === 'longitudinal'));
    const reruns = pick((l) => l.some((r) => r.kind === 'top_up' || r.kind === 'reprep'));
    const reanalysis = pick((l) => l.some((r) => r.kind === 'reanalysis' || r.kind === 'orthogonal'));
    return [
      { id: 'long', label: 'Longitudinal series', hint: 'Draws linked back to an anchor well', icon: Activity, color: color('#38bdf8'), rows: longitudinal },
      { id: 'rerun', label: 'Reruns & re-preps', hint: 'Why the sample went through again', icon: Repeat, color: color('#f59e0b'), rows: reruns },
      { id: 'reanalysis', label: 'Reanalysis', hint: 'Same reads or IDATs, new caller', icon: RefreshCcw, color: color('#a78bfa'), rows: reanalysis },
      { id: 'held', label: 'Held by consent', hint: 'Consent Registry overrides everything', icon: ShieldAlert, color: color('#fb7185'), rows: held },
    ].filter((g) => g.rows.length > 0);
  }, [stacks, color]);

  const multiCount = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className={compact ? "plate-compact-index" : "w-56 flex-shrink-0 border-r border-[var(--sot-shell-border)] bg-[var(--sot-shell-inset)] overflow-y-auto"}>
      <div className="px-3 py-2 border-b border-[var(--sot-shell-border)] flex items-center justify-between">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Sample histories</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-selected-text)]">{multiCount} wells · 2+</span>
      </div>
      {!upright && (
        <div className="mx-2 mt-2 rounded border border-teal-400/20 bg-teal-400/[0.05] px-2 py-1.5 text-[9.5px] leading-snug text-[var(--sot-shell-secondary)]">
          {compact ? 'Choose a story to explore its sample history.' : <>Pick a story below — or press <span className="font-mono text-teal-300">U</span> — to explore its sample history.</>}
        </div>
      )}
      <div className="p-2 space-y-3">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <section key={g.id}>
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <Icon size={10} style={{ color: g.color }} />
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: g.color }}>{g.label}</span>
                <span className="ml-auto text-[9px] font-mono text-[var(--sot-shell-muted)]">{g.rows.length}</span>
              </div>
              <div className="text-[8.5px] text-[var(--sot-shell-muted)] px-1 mb-1">{g.hint}</div>
              <div className="space-y-1">
                {g.rows.map((row) => {
                  const on = row.wellId === focusWellId;
                  return (
                    <button
                      key={row.wellId}
                      onClick={() => onOpen(row.wellId)}
                      className="group w-full text-left text-[10px] rounded border px-2 py-1.5 transition-colors"
                      style={{
                        borderColor: on ? withAlpha(g.color, 0.55) : 'var(--sot-shell-border)',
                        background: on ? withAlpha(g.color, 0.08) : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono px-1 rounded-sm border border-[var(--sot-shell-border)] text-[var(--sot-shell-text)] flex-shrink-0">{row.wellId}</span>
                        <span className="text-[10px] text-[var(--sot-shell-text)] truncate flex-1">{row.title}</span>
                        <ChevronRight size={10} className="text-[var(--sot-shell-muted)] group-hover:text-[var(--sot-shell-secondary)] flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {row.results.map((r) => (
                          <span
                            key={r.id}
                            title={`${r.label} · ${STATUS_LABEL[r.status]}`}
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: r.status === 'cancelled' ? 'transparent' : STATUS_COLOR[r.status],
                              border: r.status === 'cancelled' ? `1px dashed ${STATUS_COLOR[r.status]}` : 'none',
                              boxShadow: r.status === 'reportable' ? '0 0 0 1px rgba(255,255,255,0.5)' : 'none',
                            }}
                          />
                        ))}
                        <span className="ml-1 text-[8.5px] font-mono text-[var(--sot-shell-muted)] truncate">{row.sub}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-b border-[var(--sot-shell-border)] flex items-center gap-1.5">
        <Snowflake size={10} className="text-violet-300" />
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Lifecycle policies</span>
      </div>
      <div className="p-2 space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} title={rule.summary}>
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-[var(--sot-shell-text)]">{rule.prefix}</span>
              <span className="text-[var(--sot-shell-muted)]">{rule.id}</span>
            </div>
            <RuleBar rule={rule} />
            <div className="text-[8.5px] font-mono text-[var(--sot-shell-muted)] mt-0.5 leading-snug">
              {rule.transitions.map((t) => `${STORAGE_CLASSES[t.storageClass].short}${t.atDay ? ` @${t.atDay}d` : ''}`).join(' → ')}
              {rule.expireAtDay ? ` → delete @${Math.round(rule.expireAtDay / 365)}y` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleBar({ rule }: { rule: LifecycleRule }) {
  const { color } = usePlateColors();
  const horizon = Math.max(rule.expireAtDay ?? 0, ...rule.transitions.map((t) => t.atDay * 1.6), 400);
  const sx = (d: number) => (Math.sqrt(d) / Math.sqrt(horizon)) * 100;
  const segs = rule.transitions.map((t, i) => ({
    cls: t.storageClass,
    from: t.atDay,
    to: rule.transitions[i + 1]?.atDay ?? rule.expireAtDay ?? horizon,
  }));
  return (
    <div className="relative h-1.5 mt-1 rounded-full overflow-hidden bg-[var(--sot-shell-raised)]">
      {segs.map((s) => (
        <div
          key={s.from}
          className="absolute top-0 bottom-0"
          style={{ left: `${sx(s.from)}%`, width: `${sx(s.to) - sx(s.from)}%`, background: color(STORAGE_CLASSES[s.cls].color), opacity: 0.85 }}
        />
      ))}
      {rule.expireAtDay && (
        <div className="absolute top-0 bottom-0 right-0" style={{ left: `${sx(rule.expireAtDay)}%`, background: 'repeating-linear-gradient(45deg, rgba(148,163,200,0.25) 0 2px, transparent 2px 4px)' }} />
      )}
    </div>
  );
}
