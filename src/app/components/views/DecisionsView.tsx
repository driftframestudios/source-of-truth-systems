import { RELEASE_OPTIONS } from '../../services/releaseWorkflows';
import { useState } from 'react';
import { useRecordReveal } from '../useRecordReveal';
import type { RecordRequest } from '../../services/recordNavigation';
import { useReleaseRecords } from '../../services/releaseWorkflowContext';
import type { DecisionRecord } from '../../services/releaseWorkflows';
import { DecisionActions } from '../ReleaseRecordActions';
import { useSourceRecords } from '../../services/sourceSessionContext';
import { ArcBadge, InstructionCategoryBadge } from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import type { ArcId, Decision } from '../../types';

type ArcFilter = 'all' | ArcId;
type StatusFilter = 'all' | Decision['status'];

const ARC_FILTERS: Array<{ value: ArcFilter; label: string }> = [
  { value: 'all', label: 'All releases' }, ...RELEASE_OPTIONS,
];

const STATUS_CONFIG: Record<Decision['status'], { color: string; label: string; dot: string }> = {
  confirmed: { color: 'var(--sot-status-success)', label: 'Confirmed', dot: 'bg-emerald-400' },
  tentative: { color: 'var(--sot-status-warning)', label: 'Tentative', dot: 'bg-amber-400' },
  revisited: { color: '#818cf8', label: 'Revisited', dot: 'bg-indigo-400' },
};

function DecisionCard({ decision }: { decision: DecisionRecord }) {
  const config = STATUS_CONFIG[decision.status];
  const acceptedSources = useSourceRecords();
  const sources = decision.sourceIds.map((id) => acceptedSources.find(source => source.id === id)).filter(Boolean);

  return (
    <div className="border border-[var(--sot-shell-strong-border)]/[0.07] rounded overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4 bg-[var(--sot-shell-text)]/[0.01]">
        <div className="flex-shrink-0 mt-1">
          <div className={`w-2 h-2 rounded-full ${config.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-[12px] font-medium text-[var(--sot-shell-text)] leading-snug">{decision.title}</h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-mono" style={{ color: config.color }}>{config.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ArcBadge arc={decision.arc} />
            <InstructionCategoryBadge category={decision.category} />
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{decision.date}</span>
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{decision.id}</span>
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div className="px-4 pb-4 border-t border-[var(--sot-shell-strong-border)]/[0.04] pt-3">
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Rationale</div>
        <p className="text-[11px] text-[var(--sot-shell-secondary)] leading-relaxed">{decision.rationale}</p>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="px-4 pb-3 border-t border-[var(--sot-shell-strong-border)]/[0.04] pt-3">
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Source Authority</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => {
              if (!source) return null;
              return (
                <div key={source.id} className="flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02]">
                  <div className="w-1 h-1 rounded-full bg-teal-400" />
                  <span className="text-[9px] font-mono text-[var(--sot-shell-secondary)]">{source.title}</span>
                  <span className="text-[9px] text-[var(--sot-shell-muted)] truncate max-w-40">{source.title.slice(0, 40)}…</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DecisionActions record={decision} />
    </div>
  );
}

export function DecisionsView({ request }: { request?: RecordRequest } = {}) {
  const { decisions } = useReleaseRecords();
  const [arcFilter, setArcFilter] = useState<ArcFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const root = useRecordReveal(request, () => { setArcFilter('all'); setStatusFilter('all'); });

  const filtered = decisions.filter((d) => {
    if (arcFilter !== 'all' && d.arc !== arcFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  const confirmed = decisions.filter((d) => d.status === 'confirmed').length;
  const tentative = decisions.filter((d) => d.status === 'tentative').length;

  const { env } = useEnvironment();
  const { role } = useWriteGate();

  return (
    <div ref={root} className="flex flex-col h-full min-h-0">
      {/* Summary bar */}
      <div className="flex items-center gap-5 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] text-[var(--sot-shell-secondary)]">{confirmed} confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] text-[var(--sot-shell-secondary)]">{tentative} tentative</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] mr-2">{sorted.length} decisions</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{role.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--sot-shell-muted)' }}>session records</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        <div className="flex gap-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-text)]/[0.02] p-0.5">
          {ARC_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setArcFilter(value)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                arcFilter === value
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-text)]/[0.02] p-0.5">
          {(['all', 'confirmed', 'tentative', 'revisited'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)]'
              }`}
            >
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Decision list */}
      <ScrollArea role="region" aria-label="Decisions records" className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {sorted.map((decision) => (
            <div key={decision.id} data-record-id={decision.id} tabIndex={-1} className="rounded outline-sky-400">
              <DecisionCard decision={decision} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
