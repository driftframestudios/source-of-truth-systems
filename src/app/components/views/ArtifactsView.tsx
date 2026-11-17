import { arcLabel, referenceTitle } from '../../services/cartographyService';
import './artifact-workspace.css';
import { useEffect, useRef, useState } from 'react';
import { useRecordReveal } from '../useRecordReveal';
import type { RecordRequest } from '../../services/recordNavigation';
import { ArrowLeft, FileCode, GitFork, Check } from 'lucide-react';
import { useArtifactRecords } from '../../services/artifactWorkflowContext';
import type { ArtifactRecord } from '../../services/artifactWorkflows';
import { ArtifactOperations, ArtifactLocalSummary } from '../artifact/ArtifactOperations';
import { useSourceRecords } from '../../services/sourceSessionContext';
import { ArcBadge, AcceptanceBadge } from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import type { Artifact, AcceptanceResult } from '../../types';

type ViewMode = 'gallery' | 'lineage' | 'comparison';

const ACCEPTANCE_SUMMARY: Record<AcceptanceResult, { color: string; label: string }> = {
  pass: { color: 'var(--sot-status-success)', label: '✓ Pass' },
  fail: { color: 'var(--sot-status-danger)', label: '✗ Fail' },
  review: { color: 'var(--sot-status-warning)', label: '~ Review' },
  pending: { color: 'var(--sot-shell-muted)', label: '· Pending' },
};

function PassScorePie({ checks }: { checks: Artifact['acceptanceChecks'] }) {
  const pass = checks.filter((c) => c.result === 'pass').length;
  const total = checks.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {checks.map((c, i) => (
          <div
            key={i}
            className="h-2 w-2.5 rounded-sm"
            style={{ backgroundColor: ACCEPTANCE_SUMMARY[c.result].color, opacity: c.result === 'pending' ? 0.4 : 0.9 }}
            title={`${c.name}: ${c.result}`}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{pass}/{total}</span>
    </div>
  );
}

function ArtifactCard({ artifact, isSelected, onClick }: { artifact: ArtifactRecord; isSelected: boolean; onClick: () => void }) {
  const passCount = artifact.acceptanceChecks.filter((c) => c.result === 'pass').length;
  const total = artifact.acceptanceChecks.length;
  const healthPct = total > 0 ? (passCount / total) * 100 : 0;
  const healthColor = healthPct >= 80 ? 'var(--sot-status-success)' : healthPct >= 50 ? 'var(--sot-status-warning)' : 'var(--sot-status-danger)';

  return (
    <button
      data-record-id={artifact.id}
      aria-pressed={isSelected}
      onClick={onClick}
      className={`w-full text-left p-4 rounded border transition-all ${
        isSelected
          ? 'border-sky-500/40 bg-sky-500/10'
          : 'border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.04]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <ArcBadge arc={artifact.arc} />
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">Revision {artifact.pass}</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--sot-shell-secondary)] truncate">{artifact.title}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] font-mono" style={{ color: healthColor }}>{Math.round(healthPct)}%</div>
          <div className="text-[9px] text-[var(--sot-shell-muted)]">{artifact.fileSize}</div>
        </div>
      </div>
      <PassScorePie checks={artifact.acceptanceChecks} />
      <ArtifactLocalSummary record={artifact} />
      <div className="mt-2">
        <div className="text-[9px] text-[var(--sot-shell-muted)] mb-1">Changes</div>
        <div className="text-[10px] text-[var(--sot-shell-muted)] line-clamp-2 leading-relaxed">{artifact.changed.join(' · ')}</div>
      </div>
      <div className="text-[9px] text-[var(--sot-shell-muted)] mt-2">{artifact.createdAt}</div>
    </button>
  );
}

function LineageTree({ artifacts }: { artifacts: ReadonlyArray<ArtifactRecord> }) {
  const sources = useSourceRecords();
  const title = (id: string) => sources.find(source => source.id === id)?.title ?? referenceTitle(id);
  return (
    <div className="p-5">
      <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-4">Artifact Derivation Lineage</div>
      <div className="relative">
        {artifacts.map((artifact, idx) => {
          return (
            <div key={artifact.id} className="relative pl-8 pb-6 last:pb-0">
              {/* vertical connector */}
              {idx < artifacts.length - 1 && (
                <div className="absolute left-3.5 top-5 bottom-0 w-px bg-[var(--sot-shell-text)]/[0.08]" />
              )}
              <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full border flex items-center justify-center"
                style={{ borderColor: artifact.arc === 'arc_02' ? 'var(--sot-status-info)' : 'var(--sot-shell-muted)', backgroundColor: artifact.arc === 'arc_02' ? '#38bdf820' : 'var(--sot-shell-raised)' }}>
                {artifact.arc === 'arc_02' && <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-[var(--sot-shell-secondary)]">{artifact.title}</span>
                    <ArcBadge arc={artifact.arc} />
                  </div>
                  {artifact.derivedFrom.length > 0 && (
                    <div className="flex items-center gap-1 text-[9px] text-[var(--sot-shell-muted)] mb-1">
                      <GitFork size={9} />
                      <span>derived from: {artifact.derivedFrom.slice(0, 3).map(title).join(', ')}</span>
                    </div>
                  )}
                  <ArtifactLocalSummary record={artifact} />
                  <div className="flex flex-wrap gap-1">
                    {artifact.changed.slice(0, 4).map((c) => (
                      <span key={c} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-teal-500/20 bg-teal-500/5 text-teal-400">{c}</span>
                    ))}
                  </div>
                  {artifact.deferred.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {artifact.deferred.slice(0, 3).map((d) => (
                        <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/5 text-amber-400/70">{d}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <PassScorePie checks={artifact.acceptanceChecks} />
                  <div className="text-[9px] text-[var(--sot-shell-muted)] mt-1">{artifact.createdAt}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonMatrix({ artifacts }: { artifacts: ReadonlyArray<ArtifactRecord> }) {
  const dimensions = [...new Set(artifacts.flatMap(artifact => artifact.acceptanceChecks.map(check => check.name)))];

  const COLORS: Record<AcceptanceResult, string> = {
    pass: 'var(--sot-status-success)',
    fail: 'var(--sot-status-danger)',
    review: 'var(--sot-status-warning)',
    pending: 'var(--sot-shell-muted)',
  };

  return (
    <div className="p-5 overflow-x-auto">
      <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-4">Acceptance Progression Matrix</div>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left text-[9px] font-mono text-[var(--sot-shell-muted)] pb-2 pr-4 uppercase">Dimension</th>
            {artifacts.map((a) => (
              <th key={a.id} className="text-center text-[9px] font-mono text-[var(--sot-shell-muted)] pb-2 px-2 uppercase">
                <div>{arcLabel(a.arc)}</div>
                <div>Rev {a.pass}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dimensions.map((dim) => (
            <tr key={dim} className="border-t border-[var(--sot-shell-strong-border)]/[0.04]">
              <td className="text-[10px] text-[var(--sot-shell-muted)] py-2 pr-4 font-mono whitespace-nowrap">{dim}</td>
              {artifacts.map((artifact) => {
                const result = artifact.acceptanceChecks.find(check => check.name === dim)?.result;
                return (
                  <td key={artifact.id} className="text-center py-2 px-2">
                    <div
                      className="mx-auto w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono"
                      style={{ backgroundColor: result ? `color-mix(in srgb, ${COLORS[result]} 12.549%, transparent)` : 'transparent', color: result ? COLORS[result] : 'var(--sot-shell-muted)' }}
                      title={result ?? 'Not recorded'}
                    >
                      {result === 'pass' ? '✓' : result === 'fail' ? '✗' : result === 'review' ? '~' : result === 'pending' ? '·' : '—'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-[var(--sot-shell-strong-border)]/[0.1]"><th scope="row" className="text-left text-[10px] font-mono text-[var(--sot-shell-muted)] py-3">Local work</th>{artifacts.map(artifact => <td key={artifact.id} className="p-2 text-center align-top"><ArtifactLocalSummary record={artifact} /></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export function ArtifactsView({ request }: { request?: RecordRequest } = {}) {
  const artifacts = useArtifactRecords();
  const sources = useSourceRecords();
  const title = (id: string) => sources.find(source => source.id === id)?.title ?? referenceTitle(id);
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);
  const root = useRecordReveal(request, (id) => {
    setViewMode('gallery');
    setSelectedId(artifacts.some((record) => record.id === id) ? id : null);
  });

  const { env } = useEnvironment();
  const { role } = useWriteGate();
  const selectedArtifact = artifacts.find((a) => a.id === selectedId);

  useEffect(() => {
    if (selectedId && viewMode === 'gallery') detail.current?.focus({ preventScroll: true });
  }, [selectedId, viewMode]);

  const returnToGallery = () => {
    const id = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => {
      if (id) root.current?.querySelector<HTMLElement>(`[data-record-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    });
  };

  return (
    <div ref={root} className="flex flex-col h-full min-h-0 min-w-0">
      {/* View mode selector */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        {(['gallery', 'lineage', 'comparison'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded text-[10px] font-mono transition-colors capitalize ${
              viewMode === mode
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)] border border-transparent'
            }`}
          >
            {mode}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] mr-2">{artifacts.length} artifacts</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ color: env.accent, borderColor: `color-mix(in srgb, ${env.accent} 33.333%, transparent)` }}>{env.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{role.label}</span>
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">·</span>
          <span className="text-[9px] font-mono" style={{ color: 'var(--sot-shell-muted)' }}>session-local work</span>
        </div>
      </div>

      {viewMode === 'gallery' && (
        <div className="artifact-workspace flex flex-1 min-h-0" data-selected={Boolean(selectedArtifact)}>
          {/* Artifact grid stays mounted to retain its scroll position on return. */}
          <div className="artifact-workspace__gallery flex-1 min-w-0">
            <ScrollArea className="h-full">
              <div className="artifact-workspace__cards grid gap-3 p-4">
                {artifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    isSelected={selectedId === artifact.id}
                    onClick={() => setSelectedId((prev) => (prev === artifact.id ? null : artifact.id))}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Detail panel */}
          {selectedArtifact && (
            <section ref={detail} tabIndex={-1} aria-label="Artifact details" className="artifact-workspace__detail flex flex-col min-h-0 border-l border-[var(--sot-shell-strong-border)]/[0.06] outline-none">
              <header className="p-4 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
                <button onClick={returnToGallery} className="flex items-center gap-1.5 text-[10px] text-[var(--sot-shell-secondary)] hover:text-[var(--sot-shell-text)] mb-3"><ArrowLeft size={12} /> Back to gallery</button>
                <div className="flex items-start gap-2 mb-2">
                  <FileCode size={14} className="text-sky-400 shrink-0 mt-0.5" />
                  <h2 className="text-[11px] font-medium text-[var(--sot-shell-text)]">{selectedArtifact.title}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ArcBadge arc={selectedArtifact.arc} />
                  <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">Revision {selectedArtifact.pass}</span>
                  <span className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{selectedArtifact.fileSize}</span>
                </div>
              </header>
              <ScrollArea className="flex-1 min-h-0">
                <div className="artifact-workspace__detail-body p-4">
                  <div className="artifact-workspace__local min-w-0"><ArtifactOperations record={selectedArtifact} /></div>
                  <div className="artifact-workspace__evidence min-w-0">
                    <div className="mb-4">
                      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Recorded acceptance checks</div>
                      <div className="space-y-2">
                        {selectedArtifact.acceptanceChecks.map((check, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <AcceptanceBadge result={check.result} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-[var(--sot-shell-secondary)]">{check.name}</div>
                              {check.note && <div className="text-[9px] text-[var(--sot-shell-muted)] mt-0.5">{check.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Derived From</div>
                      <div className="space-y-1">
                        {selectedArtifact.derivedFrom.map((id) => (
                          <div key={id} className="flex items-center gap-1.5">
                            <GitFork size={9} className="text-[var(--sot-shell-muted)]" />
                            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{title(id)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Changes</div>
                      <div className="space-y-1">
                        {selectedArtifact.changed.map((c) => (
                          <div key={c} className="flex items-start gap-1.5">
                            <Check size={9} className="text-teal-400 mt-0.5 flex-shrink-0" />
                            <span className="text-[10px] text-[var(--sot-shell-secondary)]">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedArtifact.deferred.length > 0 && (
                      <div>
                        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-2">Deferred</div>
                        <div className="space-y-1">
                          {selectedArtifact.deferred.map((d) => (
                            <div key={d} className="flex items-start gap-1.5">
                              <span className="text-[9px] text-amber-400 mt-0.5">→</span>
                              <span className="text-[10px] text-[var(--sot-shell-muted)]">{d}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[var(--sot-shell-strong-border)]/[0.06]">
                      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mb-1">Content Hash</div>
                      <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] break-all">{selectedArtifact.contentHash}</div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </section>
          )}
        </div>
      )}

      {viewMode === 'lineage' && (
        <ScrollArea className="flex-1">
          <LineageTree artifacts={artifacts} />
        </ScrollArea>
      )}

      {viewMode === 'comparison' && (
        <ScrollArea className="flex-1">
          <ComparisonMatrix artifacts={artifacts} />
        </ScrollArea>
      )}
    </div>
  );
}
