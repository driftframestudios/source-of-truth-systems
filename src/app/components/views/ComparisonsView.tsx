import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useRecordReveal } from '../useRecordReveal';
import type { RecordRequest } from '../../services/recordNavigation';

import { ArrowRight, CheckCircle, AlertCircle, Clock, XCircle, Lock, RotateCcw } from 'lucide-react';
import { ArcBadge } from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import { useComparisonSession } from '../../services/comparisonSessionContext';
import { COMPARISON_ACTIONS, comparisonEvents, summarizeComparisons } from '../../services/comparisonSession';
import type { ComparisonEvent } from '../../services/comparisonSession';
import type { ComparisonMode, ResolutionStatus, Comparison } from '../../types';

interface Gate {
  readonly canEdit: boolean;
  readonly envLabel: string;
  readonly envWrites: boolean;
  readonly decide: (id: string, event: ComparisonEvent) => void;
}

const ACTION_ICONS = { resolve: CheckCircle, defer: AlertCircle, reopen: RotateCcw };

type ModeFilter = 'all' | ComparisonMode;

const MODE_FILTERS: Array<{ value: ModeFilter; label: string }> = [
  { value: 'all', label: 'All Modes' },
  { value: 'source_vs_source', label: 'Source vs Source' },
  { value: 'instruction_vs_artifact', label: 'Requirement vs artifact' },
  { value: 'artifact_vs_exemplar', label: 'Artifact vs specification' },
  { value: 'arc_vs_arc', label: 'Release vs release' },
  { value: 'target_vs_current', label: 'Target vs Current' },
];

const RESOLUTION_CONFIG: Record<ResolutionStatus, { icon: LucideIcon; color: string; label: string }> = {
  resolved: { icon: CheckCircle, color: 'var(--sot-status-success)', label: 'Resolved' },
  pending: { icon: Clock, color: 'var(--sot-status-warning)', label: 'Pending' },
  deferred: { icon: AlertCircle, color: 'var(--sot-shell-muted)', label: 'Deferred' },
  conflict: { icon: XCircle, color: 'var(--sot-status-danger)', label: 'Conflict' },
};

const ITEM_STATUS_COLORS: Record<Comparison['itemA']['itemStatus'], string> = {
  active: 'var(--sot-status-success)',
  partially_superseded: 'var(--sot-status-warning)',
  superseded: 'var(--sot-shell-muted)',
};

const ITEM_STATUS_LABELS: Record<Comparison['itemA']['itemStatus'], string> = {
  active: 'Active',
  partially_superseded: 'Partly Superseded',
  superseded: 'Superseded',
};

function ModePill({ mode }: { mode: ComparisonMode }) {
  const labels: Record<ComparisonMode, string> = {
    source_vs_source: 'Source ↔ Source',
    instruction_vs_artifact: 'Requirement ↔ Artifact',
    artifact_vs_exemplar: 'Artifact ↔ Spec.',
    arc_vs_arc: 'Release ↔ Release',
    target_vs_current: 'Target ↔ Current',
  };
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
      {labels[mode]}
    </span>
  );
}

function ComparisonCard({ comparison, gate }: { comparison: Comparison; gate: Gate }) {
  const resConfig = RESOLUTION_CONFIG[comparison.resolutionStatus];
  const ResIcon = resConfig.icon;

  return (
    <div className="rounded border border-[var(--sot-shell-strong-border)]/[0.07] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-2.5 bg-[var(--sot-shell-text)]/[0.02] border-b border-[var(--sot-shell-strong-border)]/[0.05]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[11px] font-medium text-[var(--sot-shell-text)]">{comparison.topic}</h2>
          <ModePill mode={comparison.mode} />
          <ArcBadge arc={comparison.arc} />
        </div>
        <div role="status" className="flex items-center gap-1.5">
          <ResIcon size={12} style={{ color: resConfig.color }} />
          <span className="text-[10px] font-mono" style={{ color: resConfig.color }}>{resConfig.label}</span>
        </div>
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
        {/* Item A */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">A — {comparison.itemA.entityLabel}</div>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{
                color: ITEM_STATUS_COLORS[comparison.itemA.itemStatus],
                borderColor: `color-mix(in srgb, ${ITEM_STATUS_COLORS[comparison.itemA.itemStatus]} 25.098%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${ITEM_STATUS_COLORS[comparison.itemA.itemStatus]} 7.059%, transparent)`,
              }}
            >
              {ITEM_STATUS_LABELS[comparison.itemA.itemStatus]}
            </span>
          </div>
          <p className="text-[11px] text-[var(--sot-shell-secondary)] leading-relaxed">{comparison.itemA.statement}</p>
        </div>

        {/* Item B */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">B — {comparison.itemB.entityLabel}</div>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{
                color: ITEM_STATUS_COLORS[comparison.itemB.itemStatus],
                borderColor: `color-mix(in srgb, ${ITEM_STATUS_COLORS[comparison.itemB.itemStatus]} 25.098%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${ITEM_STATUS_COLORS[comparison.itemB.itemStatus]} 7.059%, transparent)`,
              }}
            >
              {ITEM_STATUS_LABELS[comparison.itemB.itemStatus]}
            </span>
          </div>
          <p className="text-[11px] text-[var(--sot-shell-secondary)] leading-relaxed">{comparison.itemB.statement}</p>
        </div>
      </div>

      {/* Resolution */}
      <div className="px-4 py-3 border-t border-[var(--sot-shell-strong-border)]/[0.05] bg-[var(--sot-shell-text)]/[0.015]">
        <div className="flex items-start gap-2">
          <ArrowRight size={11} className="text-[var(--sot-shell-muted)] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">{comparison.resolutionStatus === 'resolved' ? 'Resolution' : 'Proposed resolution'}</div>
            <p className="text-[11px] text-[var(--sot-shell-text)] leading-relaxed">{comparison.resolution}</p>
            {/* Actions */}
            <div className="flex items-center gap-2 mt-2.5">
              {comparisonEvents(comparison.resolutionStatus).map(event => {
                const Icon = ACTION_ICONS[event];
                const action = COMPARISON_ACTIONS[event];
                return <button
                  key={event}
                  type="button"
                  onClick={() => gate.decide(comparison.id, event)}
                  title={action.description}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.1] bg-[var(--sot-shell-text)]/[0.03] text-[10px] font-mono text-[var(--sot-shell-secondary)] hover:bg-[var(--sot-shell-text)]/[0.05] transition-colors"
                  style={!gate.canEdit ? { opacity: 0.5, cursor: 'default' } : undefined}
                >
                  <Icon size={10} /> {action.label}
                </button>;
              })}
              {!gate.canEdit && (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono text-[var(--sot-shell-muted)]">
                  <Lock size={9} /> {gate.envWrites ? 'requires write role' : `read-only in ${gate.envLabel}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonsView({ request }: { request?: RecordRequest } = {}) {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const root = useRecordReveal(request, () => setModeFilter('all'));

  const { env, canWrite } = useEnvironment();
  const writeGate = useWriteGate();
  const { role } = writeGate;
  const { comparisons, decide } = useComparisonSession();
  const access = writeGate.check();
  const canEdit = access.ok;
  const gate: Gate = {
    canEdit,
    envLabel: env.label,
    envWrites: canWrite(),
    decide,
  };

  const filtered = comparisons.filter((c) => modeFilter === 'all' || c.mode === modeFilter);

  const summary = summarizeComparisons(comparisons);

  return (
    <section ref={root} aria-label="Comparisons" className="flex flex-col h-full min-h-0">
      {/* Summary bar */}
      <div aria-label="Comparison summary" className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        {Object.entries(summary).map(([key, count]) => {
          const config = RESOLUTION_CONFIG[key as ResolutionStatus];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <Icon size={11} style={{ color: config.color }} />
              <span className="text-[11px]" style={{ color: config.color }}>{count} {key}</span>
            </div>
          );
        })}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] mr-2">
            {filtered.length} of {comparisons.length} comparisons
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{role.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono" style={{ color: canEdit ? 'var(--sot-status-success)' : 'var(--sot-shell-muted)' }}>{canEdit ? 'read/write' : 'read-only'}</span>
          {!canEdit && <Lock size={9} className="text-[var(--sot-shell-muted)]" />}
        </div>
      </div>

      {/* Mode filter */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0 overflow-x-auto">
        {MODE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setModeFilter(value)}
            aria-pressed={modeFilter === value}
            className={`flex-shrink-0 px-2.5 py-1.5 rounded text-[10px] font-mono transition-colors ${
              modeFilter === value
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)] border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Comparison cards */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {filtered.map((comparison) => (
            <div key={comparison.id} data-record-id={comparison.id} role="region" aria-label={comparison.topic} tabIndex={-1} className="rounded outline-sky-400">
              <ComparisonCard comparison={comparison} gate={gate} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}
