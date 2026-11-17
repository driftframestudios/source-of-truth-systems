import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Dna, Target, Pill, FlaskConical, ClipboardCheck, Lock, Sparkles, Activity } from 'lucide-react';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import { isConsentHold } from '../../services/accessService';
import { useBiomarkers, useBiomarkerConsent, useRecordCommands } from '../../services/recordSessionContext';
import { reviewTransitions } from '../../services/recordSession';
import type { ReviewEvent } from '../../services/recordSession';
import { REVIEW_FLOW } from '../../types';
import { WorkflowStepper } from '../WorkflowStepper';
import type { Biomarker, BiomarkerCategory, BiomarkerActionability } from '../../types';

const CATEGORY_ORDER: ReadonlyArray<BiomarkerCategory> = ['somatic', 'germline', 'signature', 'expression', 'pgx'];

const CATEGORY_LABELS: Record<BiomarkerCategory, string> = {
  somatic: 'Somatic Variants',
  germline: 'Germline Findings',
  signature: 'Genomic Signatures',
  expression: 'Expression / IHC',
  pgx: 'Pharmacogenomics',
};

const CATEGORY_ICONS: Record<BiomarkerCategory, LucideIcon> = {
  somatic: Dna,
  germline: Dna,
  signature: Activity,
  expression: FlaskConical,
  pgx: Pill,
};

// OncoKB / ACMG actionability ramp — tier_1 most prominent (gold), down to muted "none".
const TIER_STYLE: Record<BiomarkerActionability, { label: string; color: string; bg: string; border: string }> = {
  tier_1: { label: 'Tier I', color: 'var(--sot-status-warning)', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.45)' },
  tier_2: { label: 'Tier II', color: 'var(--sot-status-success)', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.35)' },
  tier_3: { label: 'Tier III', color: 'var(--sot-status-info)', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.30)' },
  tier_4: { label: 'Tier IV', color: 'var(--sot-status-violet)', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.28)' },
  none: { label: 'None', color: 'var(--sot-shell-muted)', bg: 'color-mix(in srgb, var(--sot-shell-strong-border) 6%, transparent)', border: 'color-mix(in srgb, var(--sot-shell-strong-border) 14%, transparent)' },
};

const TIER_FILTER_ORDER: ReadonlyArray<BiomarkerActionability> = ['tier_1', 'tier_2', 'tier_3', 'tier_4', 'none'];

const REVIEW_ACCENT = 'var(--sot-status-violet)';

function Meter({ value, unit }: { value: number; unit?: string }) {
  // Normalize a heterogeneous set of scales to a rough 0–100 gauge for orientation only.
  const pct = Math.max(4, Math.min(100, value <= 1 ? value * 100 : value > 100 ? 100 : value));
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[var(--sot-shell-text)]/[0.08] overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] flex-shrink-0">
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function BiomarkerCard({ biomarker }: { biomarker: Biomarker }) {
  const { env } = useEnvironment();
  const commands = useRecordCommands();
  const consent = useBiomarkerConsent(biomarker.specimenId);
  const consentHeld = isConsentHold(consent);
  // Consent-held biomarkers are withheld from the tumor board regardless of role.
  const writeGate = useWriteGate();
  const checkAction = (event: ReviewEvent) => commands.check({ type: 'biomarker.review', id: biomarker.id, event });
  const canEdit = reviewTransitions(biomarker.reviewState).some(({ event }) => checkAction(event).ok);

  const tier = TIER_STYLE[biomarker.actionability];
  const Icon = CATEGORY_ICONS[biomarker.category];

  const advance = (event: ReviewEvent) => {
    const result = commands.execute({ type: 'biomarker.review', id: biomarker.id, event });
    if (!result.ok) writeGate.deny('Review advance', result, biomarker.id);
  };

  return (
    <div className="rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.04] transition-colors p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center bg-[var(--sot-shell-text)]/[0.03] border border-[var(--sot-shell-strong-border)]/[0.06] mt-0.5">
          <Icon size={13} className="text-[var(--sot-shell-muted)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-[var(--sot-shell-text)]">{biomarker.name}</span>
            {biomarker.gene && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">{biomarker.gene}</span>
            )}
            <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-[var(--sot-shell-text)]/[0.04] text-[var(--sot-shell-muted)] border border-[var(--sot-shell-strong-border)]/[0.06]">{biomarker.category}</span>
          </div>
          <div className="text-[10px] text-[var(--sot-shell-text)] mt-1">{biomarker.value}</div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.border}` }}
          >
            {tier.label}
          </span>
          {consentHeld && (
            <span className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--sot-status-warning)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
              <Lock size={8} /> held — consent {consent}
            </span>
          )}
        </div>
      </div>

      {typeof biomarker.numericValue === 'number' && (
        <Meter value={biomarker.numericValue} unit={biomarker.unit} />
      )}

      {biomarker.evidence.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Evidence</div>
          <div className="flex gap-1 flex-wrap">
            {biomarker.evidence.map((e) => (
              <span key={e} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">{e}</span>
            ))}
          </div>
        </div>
      )}

      {biomarker.therapies.length > 0 && (
        <div className="mt-2">
          <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Matched Therapies</div>
          <div className="flex gap-1 flex-wrap">
            {biomarker.therapies.map((t) => (
              <span key={t} className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                <Pill size={9} /> {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-3 flex-wrap text-[9px] font-mono text-[var(--sot-shell-muted)]">
        <span>specimen: <span className="text-[var(--sot-shell-muted)]">{biomarker.specimenId}</span></span>
        <span>indication: <span className="text-[var(--sot-shell-muted)]">{biomarker.indication}</span></span>
      </div>

      {biomarker.note && (
        <div
          className="mt-2 text-[9px] leading-relaxed rounded px-2 py-1.5"
          style={
            consentHeld
              ? { color: 'var(--sot-status-warning)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }
              : { color: 'var(--sot-shell-muted)', background: 'color-mix(in srgb, var(--sot-shell-strong-border) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--sot-shell-strong-border) 10%, transparent)' }
          }
        >
          {biomarker.note}
        </div>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-[var(--sot-shell-strong-border)]/[0.05]">
        <WorkflowStepper label="review" Icon={ClipboardCheck} value={biomarker.reviewState} flow={REVIEW_FLOW} actions={reviewTransitions(biomarker.reviewState)} checkAction={checkAction} onAction={advance} accent={REVIEW_ACCENT} labelWidth="w-14" />
        <div className="flex items-center justify-between mt-1">
          <div
            className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border"
            style={{
              borderColor: canEdit ? `color-mix(in srgb, ${env.accent} 33.333%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 15%, transparent)',
              color: canEdit ? env.accent : 'var(--sot-shell-muted)',
              background: canEdit ? `color-mix(in srgb, ${env.accent} 7.059%, transparent)` : 'transparent',
            }}
          >
            {!canEdit && <Lock size={9} />}
            {env.label} · {canEdit ? 'write' : 'read-only'}
          </div>
          <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Clinical review · clinical clearance</span>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col px-3 py-2 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] min-w-[104px]">
      <span className="text-[16px] font-medium" style={{ color: accent }}>{value}</span>
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

export function BiomarkerView() {
  const [categoryFilter, setCategoryFilter] = useState<BiomarkerCategory | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<BiomarkerActionability | 'all'>('all');

  const all = useBiomarkers();

  const filtered = useMemo(
    () => all.filter((b) =>
      (categoryFilter === 'all' || b.category === categoryFilter) &&
      (tierFilter === 'all' || b.actionability === tierFilter),
    ),
    [all, categoryFilter, tierFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<BiomarkerCategory, Biomarker[]>();
    for (const b of filtered) {
      const list = map.get(b.category) ?? [];
      list.push(b);
      map.set(b.category, list);
    }
    return map;
  }, [filtered]);

  const total = all.length;
  const tier1Count = all.filter((b) => b.actionability === 'tier_1').length;
  const awaitingReview = all.filter((b) => b.reviewState !== 'approved' && b.reviewState !== 'signed_off').length;
  const withTherapies = all.filter((b) => b.therapies.length > 0).length;

  const funnel = TIER_FILTER_ORDER.map((t) => ({ tier: t, count: all.filter((b) => b.actionability === t).length }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-background)]/80 flex-shrink-0">
        <Target size={14} className="text-[var(--sot-status-violet)]" />
        <div>
          <div className="text-[11px] font-medium text-[var(--sot-shell-text)]">Biomarker Panel</div>
          <div className="text-[9px] text-[var(--sot-shell-muted)]">Molecular tumor board · precision oncology actionability review</div>
        </div>
        <span className="ml-auto text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">OncoKB / ACMG tiering</span>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-surface)] flex-shrink-0 overflow-x-auto">
        <SummaryStat label="markers" value={total} accent="var(--sot-shell-text)" />
        <SummaryStat label="tier I actionable" value={tier1Count} accent="var(--sot-status-warning)" />
        <SummaryStat label="awaiting review" value={awaitingReview} accent="var(--sot-status-violet)" />
        <SummaryStat label="therapy matched" value={withTherapies} accent="var(--sot-status-success)" />

        {/* Actionability funnel */}
        <div className="flex flex-col px-3 py-2 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] flex-1 min-w-[220px]">
          <div className="flex items-center gap-1 mb-1.5">
            <Sparkles size={10} className="text-[var(--sot-shell-muted)]" />
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Actionability Funnel</span>
          </div>
          <div className="flex flex-col gap-1">
            {funnel.map((f) => {
              const style = TIER_STYLE[f.tier];
              return (
                <div key={f.tier} className="flex items-center gap-2">
                  <span className="text-[8px] font-mono w-12 flex-shrink-0" style={{ color: style.color }}>{style.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--sot-shell-text)]/[0.05] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(f.count / funnelMax) * 100}%`, background: style.color }} />
                  </div>
                  <span className="text-[8px] font-mono text-[var(--sot-shell-muted)] w-4 text-right flex-shrink-0">{f.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-5 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05] flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mr-1">category</span>
          <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} label="all" />
          {CATEGORY_ORDER.map((c) => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} label={c} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mr-1">actionability</span>
          <FilterChip active={tierFilter === 'all'} onClick={() => setTierFilter('all')} label="all" />
          {TIER_FILTER_ORDER.map((t) => (
            <FilterChip key={t} active={tierFilter === t} onClick={() => setTierFilter(t)} label={TIER_STYLE[t].label} accent={TIER_STYLE[t].color} />
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-5">
          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => {
            const list = grouped.get(cat)!;
            const Icon = CATEGORY_ICONS[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={12} className="text-[var(--sot-shell-muted)]" />
                  <span className="text-[10px] font-mono text-[var(--sot-shell-text)] uppercase tracking-wider">{CATEGORY_LABELS[cat]}</span>
                  <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{list.length}</span>
                  <div className="flex-1 h-px bg-[var(--sot-shell-text)]/[0.06]" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {list.map((b) => (
                    <BiomarkerCard key={b.id} biomarker={b} />
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-[10px] text-[var(--sot-shell-muted)] font-mono py-8 text-center">No biomarkers match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, accent }: { active: boolean; onClick: () => void; label: string; accent?: string }) {
  const color = accent ?? 'var(--sot-status-violet)';
  return (
    <button
      onClick={onClick}
      className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
      style={{
        background: active ? `color-mix(in srgb, ${color} 9.412%, transparent)` : 'color-mix(in srgb, var(--sot-shell-strong-border) 4%, transparent)',
        color: active ? color : 'var(--sot-shell-muted)',
        borderColor: active ? `color-mix(in srgb, ${color} 33.333%, transparent)` : 'rgba(255,255,255,0.06)',
      }}
    >
      {label.replace(/_/g, ' ')}
    </button>
  );
}
