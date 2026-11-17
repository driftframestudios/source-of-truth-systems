import { useSourceRecords } from '../../services/sourceSessionContext';
import { useReleaseRecords } from '../../services/releaseWorkflowContext';
import { useState } from 'react';
import { CheckCircle, AlertCircle, Circle, Zap, Eye, Upload } from 'lucide-react';
import { STORE } from '../../data';
import { releasePlanSummary } from '../../services/cartographyService';
import { SourceStatusBadge, SourceRoleBadge, InstructionStatusBadge, InstructionCategoryBadge, ArcBadge, PriorityDot } from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { useEnvironment } from '../../services/environment';
import { getRole } from '../../services/accessService';
import { usePermissionScenario } from '../../services/permissionScenario';

function ReadinessMeter({ score }: { score: number }) {
  const color = score >= 85 ? '#34d399' : score >= 70 ? '#f59e0b' : '#f87171';
  const label = score >= 85 ? 'Prepared' : score >= 70 ? 'Needs review' : 'In progress';

  return (
    <div className="p-5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-text)]/[0.02]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Planning readiness</div>
          <div className="flex items-center gap-2">
            <span className="text-[28px] font-medium" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{score}</span>
            <span className="text-[14px] text-[var(--sot-shell-muted)] font-mono">/100</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={16} style={{ color }} />
          <span className="text-[12px] font-mono" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Segments */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
        <div className="rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
        <div className="flex-1 bg-[var(--sot-shell-text)]/[0.08] rounded-full" />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">0</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">50</span>
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">100</span>
      </div>
    </div>
  );
}

function ValidationCheckList({ checks }: { checks: ReadonlyArray<string> }) {
  return (
    <div className="space-y-2">
      {checks.map((check, i) => (
        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded border border-teal-500/15 bg-teal-500/5">
          <Circle size={12} className="text-teal-400 mt-0.5 flex-shrink-0" />
          <span className="text-[10px] text-[var(--sot-shell-secondary)] leading-relaxed">{check}</span>
        </div>
      ))}
    </div>
  );
}

function DeferredList({ items }: { items: ReadonlyArray<string> }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 p-2.5 rounded border border-amber-500/15 bg-amber-500/5">
          <AlertCircle size={12} className="text-amber-400/70 mt-0.5 flex-shrink-0" />
          <span className="text-[10px] text-[var(--sot-shell-muted)] leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

export function NextArcView() {
  const packet = STORE.generationPacket;
  const { requirements } = useReleaseRecords();
  const sources = useSourceRecords();

  const { env } = useEnvironment();
  const [showPreview, setShowPreview] = useState(false);
  const { roleId } = usePermissionScenario();
  const role = getRole(roleId);
  const activeSources = packet.activeSources.map(id => sources.find(source => source.id === id)).filter(Boolean);
  const activeInstructions = packet.activeInstructions.map(id => requirements.find(item => item.id === id)).filter(Boolean);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left column */}
      <div className="flex flex-col min-h-0 w-80 flex-shrink-0 border-r border-[var(--sot-shell-strong-border)]/[0.06]">
        {/* Arc header */}
        <div className="p-4 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <ArcBadge arc={packet.arc} />
            <span className="text-[11px] text-[var(--sot-shell-secondary)] font-mono">{packet.arcLabel}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
              <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">Reference plan</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-2 text-[9px] font-mono text-[var(--sot-shell-muted)]">
            <span>{role.label}</span>
          </div>
          <p className="text-[11px] text-[var(--sot-shell-muted)] leading-relaxed">{packet.objective}</p>
        </div>

        {/* Readiness */}
        <div className="p-4 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          <ReadinessMeter score={packet.readinessScore} />
        </div>

        {/* Active Sources */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Active Sources</span>
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{activeSources.length}</span>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              {activeSources.map((source) => {
                if (!source) return null;
                return (
                  <div key={source.id} className="p-2.5 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <SourceStatusBadge status={source.status} />
                      <SourceRoleBadge role={source.role} />
                    </div>
                    <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] truncate">{source.title}</div>
                    <div className="text-[9px] text-[var(--sot-shell-muted)] mt-0.5 line-clamp-2">{source.description}</div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Center column: Active Instructions */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 border-r border-[var(--sot-shell-strong-border)]/[0.06]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Release requirements</span>
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{activeInstructions.length} requirements</span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {activeInstructions.map((instr, idx) => {
              if (!instr) return null;
              return (
                <div key={instr.id} className="flex items-start gap-3 p-3 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.03] transition-colors">
                  <div className="flex-shrink-0 w-5 h-5 rounded bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mt-0.5">
                    <span className="text-[8px] font-mono text-teal-400">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[9px] font-mono text-sky-400">{instr.id}</span>
                      <InstructionStatusBadge status={instr.status} />
                      <InstructionCategoryBadge category={instr.category} />
                      <div className="flex items-center gap-1">
                        <PriorityDot priority={instr.priority} />
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--sot-shell-text)] leading-relaxed">{instr.text}</p>
                    <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">Source: {sources.find(source => source.id === instr.sourceId)?.title ?? "Source unavailable"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right column: Validation + Deferred */}
      <div className="flex flex-col min-h-0 w-72 flex-shrink-0">
        {/* Validation checks */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Review checks</span>
          <div className="flex items-center gap-1">
            <CheckCircle size={10} className="text-teal-400" />
            <span className="text-[10px] font-mono text-teal-400">{packet.validationChecks.length}</span>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          <div className="p-3">
            <ValidationCheckList checks={packet.validationChecks} />
          </div>
        </ScrollArea>

        {/* Deferred items */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Deferred</span>
          <div className="flex items-center gap-1">
            <AlertCircle size={10} className="text-amber-400" />
            <span className="text-[10px] font-mono text-amber-400">{packet.deferred.length}</span>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3">
            <DeferredList items={packet.deferred} />
          </div>
        </ScrollArea>

        <div className="border-t border-[var(--sot-shell-strong-border)]/[0.06] p-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(value => !value)}
              aria-expanded={showPreview}
              aria-controls="release-summary"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-sky-500/30 bg-sky-500/10 text-[10px] font-mono text-sky-300 hover:bg-sky-500/15 transition-colors"
            >
              <Eye size={10} /> {showPreview ? 'Hide summary' : 'Preview summary'}
            </button>
            <button
              type="button"
              disabled
              aria-describedby="release-publish-status"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--sot-shell-strong-border)]/[0.1] text-[10px] font-mono text-[var(--sot-shell-muted)] cursor-not-allowed"
            >
              <Upload size={10} /> Publish
            </button>
          </div>
          <p id="release-publish-status" className="mt-2 text-[9px] text-[var(--sot-shell-muted)]">Review the current plan here. Publishing is unavailable in this example.</p>
          {showPreview && (
            <section id="release-summary" aria-label="Release summary" className="mt-3 rounded border border-[var(--sot-shell-strong-border)]/[0.08] bg-[var(--sot-shell-inset)] p-2.5 max-h-64 overflow-y-auto">
              <pre className="text-[10px] text-[var(--sot-shell-secondary)] leading-relaxed font-mono whitespace-pre-wrap">{releasePlanSummary(packet, { sources, requirements })}</pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
