import { overlayValue } from './plateOverlayState';
// ============================================================
// Well hover card (flat plate) and well detail panel (right rail),
// both aware of the well's result stack.
// ============================================================

import { useMemo } from 'react';
import { Layers3, Snowflake, ChevronRight } from 'lucide-react';
import type { Well, WellResult } from '../../types';
import { RESULT_KIND_LABEL, wellIdOf } from '../../data/wellResults';
import {
  ATHENA_LABEL, athenaPosture, formatBytes, readsArtifact, resolveResult,
} from '../../services/dataAvailability';
import { useEnvironment } from '../../services/environment';
import { usePlateOverlay } from './plateOverlay';
import { STATUS_LABEL } from './stackLens';
import { usePlateColors } from './usePlateColors';
import { withAlpha } from './plateGeometry';

function contaminationColor(well: Well): string {
  return well.role === 'positive_control' ? '#34d399'
    : well.role === 'negative_control' ? '#9aa0a6'
    : well.role === 'empty' ? '#3a4e66'
    : well.contaminationProb == null ? '#9aa0a6'
    : well.contaminationProb > 0.5 ? '#d63838'
    : well.contaminationProb > 0.3 ? '#f59e0b' : '#e8d36a';
}

export function WellHoverCard({ well, results }: { well: Well; results: ReadonlyArray<WellResult> }) {
  const { statusInk: STATUS_COLOR, theme, color } = usePlateColors();
  const id = wellIdOf(well.row, well.col);
  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results.slice(1)) counts.set(RESULT_KIND_LABEL[r.kind], (counts.get(RESULT_KIND_LABEL[r.kind]) ?? 0) + 1);
    return [...counts.entries()].map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ');
  }, [results]);
  return (
    <div className="rounded-md border border-[var(--sot-shell-border)] bg-[var(--sot-shell-background)]/95 shadow-2xl px-2.5 py-2 backdrop-blur-sm" style={{ maxWidth: 240 }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color(contaminationColor(well)) }} />
        <span className="text-[11px] font-mono text-[var(--sot-shell-text)]" style={{ fontWeight: 600 }}>{id}</span>
        <span className="text-[10px] font-mono text-[var(--sot-shell-secondary)] truncate">{well.sampleId ?? well.role.replace('_', ' ')}</span>
        {well.priority && well.priority !== 'routine' && (
          <span className="ml-auto text-[7px] font-mono px-1 py-0.5 rounded uppercase" style={{ backgroundColor: well.priority === 'stat' ? theme.status.danger : theme.status.warning, color: theme.shell.onAccent }}>{well.priority}</span>
        )}
      </div>
      {well.role !== 'empty' ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-mono">
          {well.assay && <span className="text-[var(--sot-shell-muted)]">assay</span>}
          {well.assay && <span className="text-[var(--sot-shell-text)] text-right">{well.assay.replace('_', ' ').toUpperCase()}</span>}
          <span className="text-[var(--sot-shell-muted)]">P(contam)</span>
          <span className="text-right" style={{ color: well.contaminationProb == null ? theme.shell.muted : well.contaminationProb > 0.3 ? theme.status.danger : theme.status.success }}>{well.contaminationProb == null ? '—' : `${(well.contaminationProb * 100).toFixed(0)}%`}</span>
          {well.dinScore != null && <span className="text-[var(--sot-shell-muted)]">DIN</span>}
          {well.dinScore != null && <span className="text-[var(--sot-shell-text)] text-right">{well.dinScore.toFixed(1)}</span>}
        </div>
      ) : (
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)]">empty well</div>
      )}
      {well.consentStatus && well.consentStatus !== 'active' && well.role === 'sample' && (
        <div
          className="text-[8px] font-mono mt-1 px-1 py-0.5 rounded"
          style={{
            color: well.consentStatus === 'rescinded' ? theme.status.danger : theme.status.warning,
            backgroundColor: well.consentStatus === 'rescinded' ? 'rgba(251,113,133,0.12)' : 'rgba(245,158,11,0.12)',
          }}
        >
          {well.consentStatus === 'rescinded' ? '⦸ consent rescinded — analysis held' : 'consent pending — held'}
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--sot-shell-border)]">
          <div className="flex items-center gap-1 flex-wrap">
            {results.map((r) => (
              <span key={r.id} className="text-[8px] font-mono px-1 rounded-full" style={{ color: STATUS_COLOR[r.status], border: `1px solid ${withAlpha(STATUS_COLOR[r.status], 0.4)}` }}>{r.label}</span>
            ))}
          </div>
          <div className="text-[8.5px] font-mono text-[var(--sot-shell-muted)] mt-1">
            {results.length === 1 ? '1 result' : `${results.length} results · ${kinds}`}
          </div>
        </div>
      )}
      <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] mt-1 pt-1 border-t border-[var(--sot-shell-border)]">
        click for detail{results.length > 1 ? ' · U opens sample history' : ''}
      </div>
    </div>
  );
}

export function WellDetail({
  well, results, focusedResultId, upright, onSelectResult, onClose,
}: {
  well: Well;
  results: ReadonlyArray<WellResult>;
  focusedResultId: string | null;
  upright: boolean;
  onSelectResult: (resultId: string) => void;
  onClose: () => void;
}) {
  const { theme, color } = usePlateColors();
  const id = wellIdOf(well.row, well.col);
  const { maskValue } = useEnvironment();
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Sample · Well {id}</span>
        <button onClick={onClose} className="text-[10px] text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]" aria-label="Close well detail">✕</button>
      </div>

      <div className="rounded border border-[var(--sot-shell-border)] bg-[var(--sot-shell-raised)] p-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: well.role === 'empty' ? theme.shell.muted : color(contaminationColor(well)) }} />
          <span className="text-[12px] text-[var(--sot-shell-text)]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{well.sampleId ?? '—'}</span>
          {well.priority && (
            <span className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider" style={{
              backgroundColor: well.priority === 'stat' ? theme.status.danger : well.priority === 'expedited' ? theme.status.warning : theme.status.success,
              color: 'var(--sot-shell-on-accent)',
            }}>{well.priority}</span>
          )}
        </div>
        <div className="text-[10px] text-[var(--sot-shell-muted)]">{well.role.replace('_', ' ')}{well.assay ? ` · ${well.assay.replace('_', ' ').toUpperCase()}` : ''}</div>
      </div>

      <div className="space-y-1.5 text-[10px] font-mono">
        {([
          ['patient', well.patientCode ? maskValue(well.patientCode) : null],
          ['tumor %', well.tumorPercent != null ? `${well.tumorPercent}%` : null],
          ['volume', well.volumeUl != null ? `${well.volumeUl} µL` : null],
          ['conc.', well.concentrationNgUl != null ? `${well.concentrationNgUl} ng/µL` : null],
          ['DIN', well.dinScore != null ? well.dinScore.toFixed(1) : null],
          ['accessioned', well.accessionedAt],
        ] as const).map(([k, v]) => v == null ? null : (
          <div key={k} className="flex justify-between">
            <span className="text-[var(--sot-shell-muted)]">{k}</span>
            <span className="text-[var(--sot-shell-text)]">{v}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span className="text-[var(--sot-shell-muted)]">P(contam)</span>
          <span style={{ color: well.contaminationProb == null ? theme.shell.muted : well.contaminationProb > 0.3 ? theme.status.danger : theme.status.success }}>{well.contaminationProb == null ? '—' : `${(well.contaminationProb * 100).toFixed(0)}%`}</span>
        </div>
      </div>

      {well.consentStatus && well.role === 'sample' && (
        <div
          className="rounded p-2 border"
          style={{
            borderColor: well.consentStatus === 'rescinded' ? 'rgba(251,113,133,0.4)' : well.consentStatus === 'pending' ? 'rgba(245,158,11,0.35)' : 'rgba(52,211,153,0.28)',
            backgroundColor: well.consentStatus === 'rescinded' ? 'rgba(251,113,133,0.08)' : well.consentStatus === 'pending' ? 'rgba(245,158,11,0.07)' : 'rgba(52,211,153,0.06)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{
              color: well.consentStatus === 'rescinded' ? theme.status.danger : well.consentStatus === 'pending' ? theme.status.warning : theme.status.success,
            }}>
              {well.consentStatus === 'rescinded' ? '⦸ Consent Rescinded' : well.consentStatus === 'pending' ? 'Consent Pending' : 'Consent Active'}
            </span>
            {well.consentStatus !== 'active' && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-[var(--sot-shell-raised)] text-[var(--sot-shell-text)]">ANALYSIS HELD</span>
            )}
          </div>
          {well.consentSetBy && <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">propagated from {well.consentSetBy}</div>}
          {well.consentUpdatedAt && <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] mt-0.5">updated {well.consentUpdatedAt}</div>}
        </div>
      )}

      {results.length > 0 && (
        <ResultHistory results={results} focusedResultId={focusedResultId} upright={upright} onSelect={onSelectResult} />
      )}

      {well.note && (
        <div
          className="text-[10px] rounded p-2 border"
          style={well.consentStatus === 'rescinded'
            ? { color: 'var(--sot-status-danger)', backgroundColor: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.3)' }
            : { color: 'var(--sot-status-warning)', backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}
        >
          ⚠ {well.note}
        </div>
      )}
    </div>
  );
}

function ResultHistory({
  results, focusedResultId, upright, onSelect,
}: {
  results: ReadonlyArray<WellResult>;
  focusedResultId: string | null;
  upright: boolean;
  onSelect: (resultId: string) => void;
}) {
  const { status: STATUS_COLOR, statusInk, kind: KIND_COLOR, athenaInk: ATHENA_COLOR } = usePlateColors();
  const overlay = usePlateOverlay();
  const rows = useMemo(() => results.map((raw) => {
    const r = overlay.apply(raw);
    const resolved = resolveResult(r);
    return { r, reads: readsArtifact(resolved), athena: athenaPosture(r, overlayValue(overlay.athena, r.id)) };
  }), [results, overlay]);
  const series = results.find((r) => r.seriesLabel)?.seriesLabel;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider flex items-center gap-1">
          <Layers3 size={10} /> Sample history · {results.length}
        </span>
        {!upright && results.length > 0 && (
          <button
            onClick={() => onSelect(results[results.length - 1].id)}
            className="flex items-center gap-0.5 text-[8.5px] font-mono text-teal-300 hover:text-teal-200"
          >
            open history <ChevronRight size={9} />
          </button>
        )}
      </div>
      {series && <div className="text-[9.5px] text-[var(--sot-status-info)] mb-1.5">{series}</div>}
      <ol className="relative space-y-1">
        <span aria-hidden className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-[var(--sot-shell-raised)]" />
        {rows.map(({ r, reads, athena }) => {
          const on = r.id === focusedResultId;
          return (
            <li key={r.id}>
              <button
                onClick={() => onSelect(r.id)}
                className="relative w-full text-left text-[10px] pl-4 pr-1.5 py-1 rounded transition-colors"
                style={{ background: on ? withAlpha(STATUS_COLOR[r.status], 0.1) : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${withAlpha(STATUS_COLOR[r.status], 0.4)}` : 'none' }}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-[7px] w-[11px] h-[11px] rounded-full"
                  style={{
                    background: r.status === 'cancelled' ? 'transparent' : STATUS_COLOR[r.status],
                    border: r.status === 'cancelled' ? `1px dashed ${STATUS_COLOR[r.status]}` : '2px solid #080f1c',
                    boxShadow: r.status === 'reportable' ? '0 0 0 1px rgba(255,255,255,0.6)' : 'none',
                  }}
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-[var(--sot-shell-text)]">{r.label}</span>
                  <span className="text-[10px] text-[var(--sot-shell-text)] truncate flex-1">{r.title}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[8.5px] font-mono">
                  <span style={{ color: KIND_COLOR[r.kind] }}>{RESULT_KIND_LABEL[r.kind]}</span>
                  <span style={{ color: statusInk[r.status] }}>· {STATUS_LABEL[r.status]}</span>
                  <span className="text-[var(--sot-shell-muted)] ml-auto">{r.runDate.slice(2)}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[8.5px] font-mono flex-wrap">
                  {reads && (
                    <span className="flex items-center gap-0.5" style={{ color: reads.readNow ? 'var(--sot-status-success)' : reads.state === 'held' ? 'var(--sot-status-danger)' : 'var(--sot-status-violet)' }}>
                      {!reads.readNow && reads.state !== 'held' && <Snowflake size={8} />}
                      {reads.artifact.kind.toUpperCase()} {formatBytes(reads.artifact.sizeBytes)} · {reads.wait}
                    </span>
                  )}
                  <span style={{ color: ATHENA_COLOR[athena.state] }}>· {ATHENA_LABEL[athena.state]}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
