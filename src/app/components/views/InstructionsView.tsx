import { RELEASE_OPTIONS } from '../../services/releaseWorkflows';
import { useState } from 'react';
import { useRecordReveal } from '../useRecordReveal';
import type { RecordRequest } from '../../services/recordNavigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useReleaseRecords } from '../../services/releaseWorkflowContext';
import { RequirementActions } from '../ReleaseRecordActions';
import { useSourceRecords } from '../../services/sourceSessionContext';
import {
  InstructionStatusBadge, InstructionCategoryBadge, ArcBadge, PriorityDot,
} from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import type { InstructionStatus, InstructionCategory, ArcId, Instruction } from '../../types';

type StatusFilter = 'all' | InstructionStatus;
type CategoryFilter = 'all' | InstructionCategory;
type ArcFilter = 'all' | ArcId;

const STATUS_TABS: Array<{ value: StatusFilter; label: string; color: string }> = [
  { value: 'all', label: 'All', color: '' },
  { value: 'active', label: 'Active', color: 'text-teal-300' },
  { value: 'deferred', label: 'Deferred', color: 'text-amber-300' },
  { value: 'superseded', label: 'Superseded', color: 'text-slate-400' },
  { value: 'target_state', label: 'Target State', color: 'text-sky-300' },
];

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'aesthetic', label: 'Aesthetic' },
  { value: 'scientific', label: 'Scientific' },
  { value: 'rendering_order', label: 'Render Order' },
  { value: 'operational', label: 'Operational' },
];

const ARC_OPTIONS: Array<{ value: ArcFilter; label: string }> = [
  { value: 'all', label: 'All releases' }, ...RELEASE_OPTIONS,
];

type SortKey = 'priority' | 'status' | 'id' | 'arc';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortInstructions<T extends Instruction>(instrs: ReadonlyArray<T>, key: SortKey, dir: 'asc' | 'desc'): T[] {
  const sorted = [...instrs].sort((a, b) => {
    let cmp = 0;
    if (key === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    else if (key === 'status') cmp = a.status.localeCompare(b.status);
    else if (key === 'id') cmp = a.id.localeCompare(b.id);
    else if (key === 'arc') cmp = a.arc.localeCompare(b.arc);
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

function SortHeader({
  label, sortKey, currentSort, currentDir, onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider transition-colors ${
        active ? 'text-sky-400' : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)]'
      }`}
    >
      {label}
      {active ? (
        currentDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
      ) : null}
    </button>
  );
}

export function InstructionsView({ request }: { request?: RecordRequest } = {}) {
  const { requirements } = useReleaseRecords();
  const sources = useSourceRecords();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [arcFilter, setArcFilter] = useState<ArcFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const root = useRecordReveal(request, (id) => {
    setStatusFilter('all'); setCategoryFilter('all'); setArcFilter('all');
    setExpandedId(requirements.some((record) => record.id === id) ? id : null);
  });

  const { env } = useEnvironment();
  const { role } = useWriteGate();
  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  const filtered = requirements.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (arcFilter !== 'all' && i.arc !== arcFilter) return false;
    return true;
  });

  const sorted = sortInstructions(filtered, sortKey, sortDir);

  const counts = {
    active: requirements.filter((i) => i.status === 'active').length,
    deferred: requirements.filter((i) => i.status === 'deferred').length,
    superseded: requirements.filter((i) => i.status === 'superseded').length,
  };

  return (
    <div ref={root} className="flex flex-col h-full min-h-0">
      {/* Summary bar */}
      <div className="flex items-center gap-6 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="text-[11px] text-[var(--sot-shell-secondary)]">{counts.active} active</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] text-[var(--sot-shell-secondary)]">{counts.deferred} deferred</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          <span className="text-[11px] text-[var(--sot-shell-secondary)]">{counts.superseded} superseded</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] mr-2">
            Showing {sorted.length} of {requirements.length}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{role.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--sot-shell-muted)' }}>session records</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0 overflow-x-auto">
        {/* Status tabs */}
        <div className="flex gap-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-text)]/[0.02] p-0.5">
          {STATUS_TABS.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                statusFilter === value
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : `${color || 'text-[var(--sot-shell-muted)]'} hover:text-[var(--sot-shell-muted)]`
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[var(--sot-shell-text)]/[0.1]" />

        {/* Category select */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="text-[10px] font-mono bg-[var(--sot-shell-text)]/[0.03] border border-[var(--sot-shell-strong-border)]/[0.08] rounded px-2 py-1 text-[var(--sot-shell-secondary)] outline-none appearance-none cursor-pointer"
        >
          {CATEGORY_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value} className="bg-[var(--sot-shell-surface)]">{label}</option>
          ))}
        </select>

        {/* Arc select */}
        <select
          value={arcFilter}
          onChange={(e) => setArcFilter(e.target.value as ArcFilter)}
          className="text-[10px] font-mono bg-[var(--sot-shell-text)]/[0.03] border border-[var(--sot-shell-strong-border)]/[0.08] rounded px-2 py-1 text-[var(--sot-shell-secondary)] outline-none appearance-none cursor-pointer"
        >
          {ARC_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value} className="bg-[var(--sot-shell-surface)]">{label}</option>
          ))}
        </select>
      </div>

      {/* Table header */}
      <div className="grid px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0" style={{ gridTemplateColumns: '7rem 1fr 7rem 6rem 6rem 4rem' }}>
        <SortHeader label="ID" sortKey="id" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Requirement</span>
        <SortHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Category</span>
        <SortHeader label="Release" sortKey="arc" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
        <SortHeader label="Priority" sortKey="priority" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
      </div>

      {/* Rows */}
      <ScrollArea role="region" aria-label="Requirements records" className="flex-1 min-h-0">
        <div>
          {sorted.map((instr) => {
            const isExpanded = expandedId === instr.id;
            const source = sources.find(source => source.id === instr.sourceId);
            return (
              <div key={instr.id} className={`border-b border-[var(--sot-shell-strong-border)]/[0.04] ${instr.status === 'deferred' ? 'opacity-70' : ''}`}>
                <button
                  data-record-id={instr.id}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId((prev) => (prev === instr.id ? null : instr.id))}
                  className="w-full text-left px-4 py-2.5 grid hover:bg-[var(--sot-shell-text)]/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '7rem 1fr 7rem 6rem 6rem 4rem' }}
                >
                  <span className="text-[10px] font-mono text-sky-400 self-center">{instr.id}</span>
                  <span className="text-[11px] text-[var(--sot-shell-text)] self-center leading-snug pr-4 text-left">{instr.text}</span>
                  <div className="self-center"><InstructionStatusBadge status={instr.status} /></div>
                  <div className="self-center"><InstructionCategoryBadge category={instr.category} /></div>
                  <div className="self-center"><ArcBadge arc={instr.arc} /></div>
                  <div className="self-center flex items-center gap-1.5">
                    <PriorityDot priority={instr.priority} />
                    <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] capitalize">{instr.priority}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 bg-[var(--sot-shell-text)]/[0.015] border-t border-[var(--sot-shell-strong-border)]/[0.04]">
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Source</div>
                        <div className="text-[10px] font-mono text-[var(--sot-shell-secondary)]">{source?.title ?? "Source unavailable"}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Applies to</div>
                        <div className="flex flex-wrap gap-1">
                          {instr.appliesTo.map((a) => (
                            <span key={a} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] text-[var(--sot-shell-muted)]">{a.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1.5">Rationale</div>
                        <p className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed">{instr.reason}</p>
                      </div>
                    </div>

                    <RequirementActions record={instr} records={requirements} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
