import './cohort-builder.css';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Dna, FlaskConical, Gauge, ShieldAlert, Target, MapPin, Layers, Activity, Database,
  Link2, Unlink, Plus, X, Ban, Save, Lock, GitMerge, Braces, CircleDot, Filter,
  ChevronRight, Sparkles, RotateCcw, ListTree, ShieldCheck,
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { STORE } from '../../data';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import { usePermissionScenario } from '../../services/permissionScenario';
import { useNotifications } from '../../services/notifications';
import { meetsSpecimenTarget, specimenTargetLabel } from '../../services/specimenQuality';
import type { Specimen, Biomarker } from '../../types';
import { useSpecimens, useBiomarkers } from '../../services/recordSessionContext';
import { useCohortSession } from '../../services/cohortSessionContext';
import { COHORT_LIMITS, cohortFacetOptions, createCohortProjection } from '../../services/cohortRules';
import type { Facet, Joiner, PredicateNode, GroupNode, RuleNode } from '../../services/cohortRules';
import { cohortEditorReducer, createCohortEditor } from '../../services/cohortEditor';
import type { SavedCohortRule } from '../../services/cohortSession';

// ============================================================
// Rule model
// ============================================================

interface FacetDef {
  readonly id: Facet;
  readonly label: string;
  readonly family: 'Specimen' | 'Governance' | 'QC' | 'Biomarker';
  readonly icon: LucideIcon;
  readonly accent: string;
  readonly mode: 'enum' | 'gte' | 'bool';
  readonly options: ReadonlyArray<string>;
  readonly unit?: string;
}

const fmt = (s: string) => s.replace(/_/g, ' ');
const OPTIONS = cohortFacetOptions(STORE.specimens);
const FACETS: ReadonlyArray<FacetDef> = [
  { id: 'assay', label: 'Assay', family: 'Specimen', icon: Dna, accent: 'var(--cohort-teal)', mode: 'enum', options: OPTIONS.assay },
  { id: 'priority', label: 'Priority', family: 'Specimen', icon: Activity, accent: 'var(--cohort-rose)', mode: 'enum', options: OPTIONS.priority },
  { id: 'stage', label: 'Pipeline stage', family: 'Specimen', icon: Layers, accent: 'var(--cohort-sky)', mode: 'enum', options: OPTIONS.stage },
  { id: 'orderState', label: 'Order workflow', family: 'Specimen', icon: GitMerge, accent: 'var(--cohort-sky)', mode: 'enum', options: OPTIONS.orderState },
  { id: 'tumorPercent', label: 'Tumor content ≥', family: 'Specimen', icon: FlaskConical, accent: 'var(--cohort-violet)', mode: 'gte', options: OPTIONS.tumorPercent, unit: '%' },
  { id: 'consent', label: 'Consent', family: 'Governance', icon: ShieldAlert, accent: 'var(--cohort-amber)', mode: 'enum', options: OPTIONS.consent },
  { id: 'dataClass', label: 'Data class', family: 'Governance', icon: Database, accent: 'var(--cohort-blue)', mode: 'enum', options: OPTIONS.dataClass },
  { id: 'geography', label: 'Geography', family: 'Governance', icon: MapPin, accent: 'var(--cohort-slate)', mode: 'enum', options: OPTIONS.geography },
  { id: 'coverageMet', label: 'All metric targets met', family: 'QC', icon: Gauge, accent: 'var(--cohort-mint)', mode: 'bool', options: OPTIONS.coverageMet },
  { id: 'qcFlagged', label: 'Has QC flag', family: 'QC', icon: ShieldCheck, accent: 'var(--cohort-red)', mode: 'bool', options: OPTIONS.qcFlagged },
  { id: 'variantsCalled', label: 'Variants called ≥', family: 'QC', icon: CircleDot, accent: 'var(--cohort-cyan)', mode: 'gte', options: OPTIONS.variantsCalled },
  { id: 'biomarkerCategory', label: 'Biomarker class', family: 'Biomarker', icon: Target, accent: 'var(--cohort-amber)', mode: 'enum', options: OPTIONS.biomarkerCategory },
  { id: 'biomarkerTier', label: 'Actionability tier', family: 'Biomarker', icon: Sparkles, accent: 'var(--cohort-pink)', mode: 'enum', options: OPTIONS.biomarkerTier },
  { id: 'biomarkerReview', label: 'Biomarker review', family: 'Biomarker', icon: ShieldCheck, accent: 'var(--cohort-pink)', mode: 'enum', options: OPTIONS.biomarkerReview },
];

const facetById = (id: Facet) => FACETS.find((f) => f.id === id)!;

let seq = 0;
const nid = (p: string) => `${p}_${(++seq).toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

const pred = (facet: Facet, value: string, negated = false): PredicateNode =>
  ({ kind: 'predicate', id: nid('p'), facet, value, negated });

function predicateText(p: PredicateNode): string {
  const f = facetById(p.facet);
  if (f.mode === 'bool') return f.label;
  if (f.mode === 'gte') return `${f.label} ${p.value}${f.unit ?? ''}`;
  return `${f.label} = ${fmt(p.value)}`;
}

function toExpression(node: RuleNode, depth = 0): string {
  const inner = node.kind === 'predicate'
    ? `${node.facet}${facetById(node.facet).mode === 'gte' ? '>=' : '='}${node.value}`
    : node.children.length === 0 ? 'TRUE'
      : node.children.map((c) => toExpression(c, depth + 1)).join(` ${node.joiner} `);
  const wrapped = node.kind === 'group' && depth > 0 && node.children.length > 1 ? `(${inner})` : inner;
  return node.negated ? `NOT ${node.kind === 'group' && node.children.length > 1 && depth === 0 ? `(${wrapped})` : wrapped}` : wrapped;
}

function countPredicates(n: RuleNode): number {
  return n.kind === 'predicate' ? 1 : n.children.reduce((a, c) => a + countPredicates(c), 0);
}

// Seed rule: tumor-board-ready actionable NSCLC/colorectal cohort.
const SEED: GroupNode = {
  kind: 'group', id: 'root', joiner: 'AND', negated: false, label: 'Cohort root',
  children: [
    {
      kind: 'group', id: nid('g'), joiner: 'OR', negated: false, label: 'Actionable signal',
      children: [pred('biomarkerTier', 'tier_1'), pred('biomarkerCategory', 'signature')],
    },
    pred('coverageMet', 'true'),
    pred('consent', 'rescinded', true),
  ],
};

const PRESETS: ReadonlyArray<{ id: string; label: string; build: () => GroupNode }> = [
  { id: 'tb', label: 'Tumor-board ready', build: () => ({ ...SEED, children: SEED.children.map((c) => c) }) },
  {
    id: 'reseq', label: 'Re-sequence candidates', build: () => ({
      kind: 'group', id: 'root', joiner: 'AND', negated: false, label: 'Cohort root',
      children: [
        { kind: 'group', id: nid('g'), joiner: 'OR', negated: false, label: 'QC concern', children: [pred('qcFlagged', 'true'), pred('coverageMet', 'true', true)] },
        pred('consent', 'active'),
      ],
    }),
  },
  {
    id: 'gov', label: 'Governance holds', build: () => ({
      kind: 'group', id: 'root', joiner: 'OR', negated: false, label: 'Cohort root',
      children: [pred('consent', 'rescinded'), pred('consent', 'pending'), pred('consent', 'expired')],
    }),
  },
];

// ============================================================
// Palette card (draggable source)
// ============================================================

function PaletteCard({ facet, onAdd, count }: { facet: FacetDef; onAdd: (f: Facet, v: string) => void; count: (f: Facet, v: string) => number }) {
  const Icon = facet.icon;
  const counts = facet.options.map((o) => count(facet.id, o));
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/facet', `${facet.id}|${facet.options[0]}`); }}
      className="break-inside-avoid mb-2.5 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:border-[var(--sot-shell-strong-border)]/[0.14] transition-colors cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
        <Icon size={11} style={{ color: facet.accent }} />
        <span className="text-[10px] text-[var(--sot-shell-text)] flex-1 truncate">{facet.label}</span>
        <span className="text-[8px] font-mono text-[var(--sot-shell-muted)] uppercase">{facet.mode}</span>
      </div>
      <div className="flex flex-wrap gap-1 p-2">
        {facet.options.map((o, i) => (
          <button
            key={o}
            onClick={() => onAdd(facet.id, o)}
            className="group flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors hover:bg-[var(--sot-shell-text)]/[0.04]"
            style={{ borderColor: `color-mix(in srgb, ${facet.accent} 20.000%, transparent)`, color: 'var(--sot-shell-secondary)' }}
            title={`Add ${facet.label} ${o} to the focused group`}
          >
            <Plus size={8} className="opacity-50 group-hover:opacity-100" style={{ color: facet.accent }} />
            {facet.mode === 'bool' ? 'is true' : facet.mode === 'gte' ? `${o}${facet.unit ?? ''}` : fmt(o)}
            <span className="text-[var(--sot-shell-muted)]">{counts[i]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Canvas nodes
// ============================================================

interface CanvasCtx {
  readonly rootId: string;
  readonly selected: ReadonlySet<string>;
  readonly focusId: string;
  readonly specimenCount: number;
  readonly matchCount: (n: RuleNode) => number;
  toggleSelect: (id: string) => void;
  setFocus: (id: string) => void;
  update: (id: string, fn: (n: RuleNode) => RuleNode) => void;
  remove: (id: string) => void;
  unlink: (id: string) => void;
  drop: (groupId: string, facet: Facet, value: string) => void;
}

function NegateChip({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 text-[8px] font-mono px-1 py-0.5 rounded border transition-colors"
      style={{
        borderColor: on ? 'color-mix(in srgb, var(--cohort-rose) 50%, transparent)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 12%, transparent)',
        color: on ? 'var(--sot-status-danger)' : 'var(--sot-shell-muted)',
        background: on ? 'color-mix(in srgb, var(--cohort-rose) 8%, transparent)' : 'transparent',
      }}
      title="Toggle NOT"
    >
      <Ban size={8} /> NOT
    </button>
  );
}

function PredicateCard({ node, ctx }: { node: PredicateNode; ctx: CanvasCtx }) {
  const f = facetById(node.facet);
  const Icon = f.icon;
  const sel = ctx.selected.has(node.id);
  const n = ctx.matchCount(node);
  return (
    <div
      className="cohort-predicate relative rounded border bg-[var(--sot-shell-surface)] transition-all"
      data-selected={sel} data-negated={node.negated}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l" style={{ background: f.accent }} />
      <div className="flex items-center gap-1.5 pl-3 pr-1.5 pt-1.5">
        <input
          type="checkbox"
          checked={sel}
          onChange={() => ctx.toggleSelect(node.id)}
          className="accent-sky-400 w-3 h-3"
          aria-label={`Select ${f.label} card for linking`}
        />
        <Icon size={11} style={{ color: f.accent }} />
        <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)]">{f.family}</span>
        <div className="ml-auto flex items-center gap-1">
          <NegateChip on={node.negated} onClick={() => ctx.update(node.id, (x) => ({ ...(x as PredicateNode), negated: !x.negated }))} />
          <button onClick={() => ctx.remove(node.id)} className="p-0.5 text-[var(--sot-shell-muted)] hover:text-[var(--sot-status-danger)]" aria-label="Remove card">
            <X size={10} />
          </button>
        </div>
      </div>
      <div className="pl-3 pr-2 pb-2 pt-1">
        <div className="text-[11px] text-[var(--sot-shell-text)] mb-1">{f.label}</div>
        {f.mode === 'bool' ? (
          <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">is true</span>
        ) : (
          <select
            value={node.value}
            onChange={(e) => ctx.update(node.id, (x) => ({ ...(x as PredicateNode), value: e.target.value }))}
            className="w-full bg-[var(--sot-shell-text)]/[0.03] border border-[var(--sot-shell-strong-border)]/[0.08] rounded text-[10px] font-mono text-[var(--sot-shell-text)] px-1.5 py-0.5 focus:outline-none focus:border-sky-400/50"
          >
            {f.options.map((o) => (
              <option key={o} value={o} className="bg-[var(--sot-shell-background)]">
                {f.mode === 'gte' ? `≥ ${o}${f.unit ?? ''}` : fmt(o)}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">{node.id}</span>
          <span className="text-[8px] font-mono" style={{ color: n ? 'var(--sot-status-success)' : 'var(--sot-shell-muted)' }}>{n} / {ctx.specimenCount} specimens</span>
        </div>
      </div>
    </div>
  );
}

function GroupCard({ node, ctx, depth }: { node: GroupNode; ctx: CanvasCtx; depth: number }) {
  const [over, setOver] = useState(false);
  const focused = ctx.focusId === node.id;
  const sel = ctx.selected.has(node.id);
  const accent = node.joiner === 'AND' ? 'var(--cohort-teal)' : 'var(--cohort-amber)';
  const isRoot = node.id === ctx.rootId;
  return (
    <div
      data-cohort-group={node.id}
      data-focused={focused}
      onClick={(e) => { e.stopPropagation(); ctx.setFocus(node.id); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        const [f, v] = e.dataTransfer.getData('text/facet').split('|');
        if (f) ctx.drop(node.id, f as Facet, v);
      }}
      className="cohort-group rounded-md border transition-all"
      data-depth-tone={depth % 2 ? 'odd' : 'even'} data-over={over}
      style={{
        borderColor: over ? 'var(--cohort-sky)' : sel ? 'var(--cohort-sky)' : focused ? `color-mix(in srgb, ${accent} var(--cohort-focus-strength), transparent)` : `color-mix(in srgb, ${accent} var(--cohort-group-strength), transparent)`,
        borderStyle: isRoot ? 'solid' : 'dashed',
      }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b" style={{ borderColor: `color-mix(in srgb, ${accent} 13.333%, transparent)` }}>
        {!isRoot && (
          <input type="checkbox" checked={sel} onChange={() => ctx.toggleSelect(node.id)} onClick={(e) => e.stopPropagation()}
            className="accent-sky-400 w-3 h-3" aria-label="Select group for linking" />
        )}
        <GitMerge size={11} style={{ color: accent }} />
        <input
          aria-label="Group label" maxLength={COHORT_LIMITS.label}
          value={node.label}
          onChange={(e) => ctx.update(node.id, (x) => ({ ...(x as GroupNode), label: e.target.value }))}
          className="bg-transparent text-[10px] text-[var(--sot-shell-text)] focus:outline-none min-w-0 w-32"
        />
        <div className="flex rounded border overflow-hidden ml-1" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 14%, transparent)' }}>
          {(['AND', 'OR'] as const).map((j) => (
            <button
              key={j}
              onClick={(e) => { e.stopPropagation(); ctx.update(node.id, (x) => ({ ...(x as GroupNode), joiner: j })); }}
              className="text-[8px] font-mono px-1.5 py-0.5 transition-colors"
              style={{
                background: node.joiner === j ? (j === 'AND' ? 'rgba(45,212,191,0.16)' : 'rgba(245,158,11,0.16)') : 'transparent',
                color: node.joiner === j ? (j === 'AND' ? 'var(--sot-status-success)' : 'var(--sot-status-warning)') : 'var(--sot-shell-muted)',
              }}
            >
              {j}
            </button>
          ))}
        </div>
        <NegateChip on={node.negated} onClick={() => ctx.update(node.id, (x) => ({ ...(x as GroupNode), negated: !x.negated }))} />
        {focused && <span className="text-[8px] font-mono text-sky-400 ml-1">● focus target</span>}
        <span className="ml-auto text-[8px] font-mono text-[var(--sot-shell-muted)]">{ctx.matchCount(node)} match</span>
        {!isRoot && (
          <>
            <button onClick={(e) => { e.stopPropagation(); ctx.unlink(node.id); }} className="p-0.5 text-[var(--sot-shell-muted)] hover:text-amber-400" title="Unlink group">
              <Unlink size={10} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); ctx.remove(node.id); }} className="p-0.5 text-[var(--sot-shell-muted)] hover:text-[var(--sot-status-danger)]" title="Remove group">
              <X size={10} />
            </button>
          </>
        )}
      </div>
      <div className="p-2.5">
        {node.children.length === 0 ? (
          <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] text-center py-5 border border-dashed border-[var(--sot-shell-strong-border)]/[0.06] rounded">
            Drop facet cards here — empty group evaluates TRUE
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
            {node.children.map((c, i) => (
              <div key={c.id} className="relative" style={{ gridColumn: c.kind === 'group' ? '1 / -1' : undefined }}>
                {i > 0 && (
                  <span
                    className="absolute -top-2 left-2 z-10 text-[7px] font-mono px-1 rounded"
                    style={{ background: 'var(--sot-shell-background)', color: accent, border: `1px solid color-mix(in srgb, ${accent} 26.667%, transparent)` }}
                  >
                    {node.joiner}
                  </span>
                )}
                {c.kind === 'group'
                  ? <GroupCard node={c} ctx={ctx} depth={depth + 1} />
                  : <PredicateCard node={c} ctx={ctx} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Printed rule (clear list)
// ============================================================

function RuleListing({ node, depth = 0, joiner, index }: { node: RuleNode; depth?: number; joiner?: Joiner; index: number }) {
  const prefix = index > 0 && joiner ? joiner : depth === 0 ? 'WHERE' : '';
  const prefixColor = prefix === 'AND' ? 'var(--cohort-teal)' : prefix === 'OR' ? 'var(--cohort-amber)' : 'var(--cohort-sky)';
  if (node.kind === 'predicate') {
    const f = facetById(node.facet);
    const Icon = f.icon;
    return (
      <li className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 14 }}>
        <span className="w-8 text-[8px] font-mono text-right flex-shrink-0" style={{ color: prefixColor }}>{prefix}</span>
        {node.negated && <span className="text-[8px] font-mono px-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">NOT</span>}
        <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${f.accent} 9.412%, transparent)` }}>
          <Icon size={9} style={{ color: f.accent }} />
        </span>
        <span className="text-[10px] text-[var(--sot-shell-text)] truncate">{predicateText(node)}</span>
        <span className="ml-auto text-[7px] font-mono uppercase text-[var(--sot-shell-muted)]">{f.family}</span>
      </li>
    );
  }
  return (
    <>
      <li className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 14 }}>
        <span className="w-8 text-[8px] font-mono text-right flex-shrink-0" style={{ color: prefixColor }}>{prefix}</span>
        {node.negated && <span className="text-[8px] font-mono px-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">NOT</span>}
        <ListTree size={10} className={node.joiner === 'AND' ? 'text-teal-400' : 'text-amber-400'} />
        <span className="text-[10px] text-[var(--sot-shell-secondary)]">{node.label}</span>
        <span className="text-[8px] font-mono px-1 rounded" style={{
          color: node.joiner === 'AND' ? 'var(--sot-status-success)' : 'var(--sot-status-warning)',
          background: node.joiner === 'AND' ? 'rgba(45,212,191,0.1)' : 'rgba(245,158,11,0.1)',
        }}>
          {node.joiner === 'AND' ? 'all of' : 'any of'}
        </span>
      </li>
      {node.children.map((c, i) => (
        <RuleListing key={c.id} node={c} depth={depth + 1} joiner={node.joiner} index={i} />
      ))}
    </>
  );
}

// ============================================================
// Result masonry card
// ============================================================

function ResultCard({ s, biomarkers }: { s: Specimen; biomarkers: ReadonlyArray<Biomarker> }) {
  const held = s.consent === 'rescinded' || s.consent === 'pending' || s.consent === 'expired';
  const bms = biomarkers;
  return (
    <div className={`break-inside-avoid mb-2.5 rounded border ${held ? 'border-rose-500/40 bg-rose-500/[0.05]' : 'border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02]'}`}>
      {held && (
        <div className="flex items-center gap-1 px-2.5 py-1 border-b border-rose-500/30 text-[8px] font-mono text-rose-400">
          <Lock size={8} /> consent {s.consent} · excluded from eligible cohort
        </div>
      )}
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-[var(--sot-shell-text)]">{s.id}</span>
          {s.plateWell && <span className="text-[8px] font-mono px-1 rounded bg-[var(--sot-shell-text)]/[0.05] text-[var(--sot-shell-muted)]">{s.plateWell}</span>}
          <span className="ml-auto text-[8px] font-mono uppercase text-[var(--sot-shell-muted)]">{fmt(s.assay)}</span>
        </div>
        <div className="text-[10px] text-[var(--sot-shell-secondary)] mt-0.5">{s.indication}</div>
        <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] mt-0.5">{s.specimenType}{s.tumorPercent != null ? ` · ${s.tumorPercent}% tumor` : ''}</div>
        <div className="flex gap-0.5 mt-1.5">
          {s.coverage.map((c) => (
            <div key={c.label} className="flex-1 h-1 rounded-full" title={`${c.label} ${c.value}${c.unit ?? ''} · ${specimenTargetLabel(c)}`}
              style={{ background: meetsSpecimenTarget(c) ? 'var(--cohort-mint)' : 'var(--cohort-amber)', opacity: 0.8 }} />
          ))}
        </div>
        {bms.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {bms.map((b) => (
              <span key={b.id} className="cohort-result-marker text-[8px] font-mono px-1 py-0.5 rounded border border-amber-500/25 text-amber-300/90">
                {b.name} · {b.actionability.replace('tier_', 'T')}
              </span>
            ))}
          </div>
        )}
        {s.qcFlags.length > 0 && (
          <div className="cohort-result-flag text-[8px] font-mono text-rose-300/80 mt-1">⚑ {s.qcFlags.join(' · ')}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// View
// ============================================================

export function BooleanBuilderView() {
  const { env } = useEnvironment();
  const { pushToast } = useNotifications();
  const { principal } = usePermissionScenario();
  const writeGate = useWriteGate();
  const role = writeGate.role;
  const access = writeGate.check({ action: 'workspace.edit', subjectId: 'cohort-rules' });
  const canEdit = access.ok;

  const [editor, dispatch] = useReducer(cohortEditorReducer, SEED, createCohortEditor);
  const { root, selected, focusId } = editor;
  const [supportPane, setSupportPane] = useState<'facets' | 'rule'>('facets');
  const [family, setFamily] = useState<FacetDef['family'] | 'All'>('All');
  const [ruleName, setRuleName] = useState('Tumor-board ready · actionable');
  const { state: { rules: saved }, commands } = useCohortSession();
  const [loaded, setLoaded] = useState<{ id: string; revision: number } | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (editor.issue === 'siblings') {
      pushToast({ severity: 'warning', title: 'Choose cards in one group', message: 'Choose cards under the same parent group, or unlink a nested group first.' });
      dispatch({ type: 'clearIssue' });
    }
  }, [editor.issue, pushToast]);
  const edit = (action: Parameters<typeof cohortEditorReducer>[1]) => { dispatch(action); setNotice(''); };
  const specimens = useSpecimens();
  const biomarkers = useBiomarkers();
  const projection = useMemo(() => createCohortProjection(specimens, biomarkers), [specimens, biomarkers]);

  const { matched: matches, eligible, held } = useMemo(() => projection.match(root), [root, projection]);
  const expr = useMemo(() => toExpression(root), [root]);

  const ctx: CanvasCtx = {
    rootId: root.id, selected, focusId,
    matchCount: projection.count,
    specimenCount: specimens.length,
    toggleSelect: (id) => dispatch({ type: 'select', id }),
    setFocus: (id) => dispatch({ type: 'focus', id }),
    update: (id, update) => edit({ type: 'update', id, update }),
    remove: (id) => edit({ type: 'remove', id }),
    unlink: (id) => edit({ type: 'unlink', id }),
    drop: (id, f, v) => {
      if (!Object.prototype.hasOwnProperty.call(OPTIONS, f) || !OPTIONS[f].includes(v)) return;
      edit({ type: 'add', id, node: pred(f, v) });
    },
  };
  const addToFocus = (f: Facet, v: string) => ctx.drop(focusId, f, v);
  const link = (joiner: Joiner) => edit({ type: 'link', id: nid('g'), joiner, label: joiner === 'AND' ? 'Linked · all of' : 'Linked · any of' });
  const openRule = (rule: SavedCohortRule) => {
    edit({ type: 'open', root: rule.root }); setRuleName(rule.name); setLoaded({ id: rule.id, revision: rule.revision });
  };
  const saveRule = (copy = false) => {
    dispatch({ type: 'clearIssue' });
    const definition = { name: ruleName, root };
    const result = commands.execute(loaded && !copy
      ? { type: 'update', ...loaded, definition }
      : { type: 'create', definition });
    if (!result.ok) { setNotice(result.reason); return; }
    setLoaded({ id: result.id, revision: result.revision });
    setSupportPane('rule');
    setNotice(`${loaded && !copy ? 'Rule updated' : 'Rule saved'} for this browser session.`);
  };
  const removeRule = (rule: SavedCohortRule) => {
    const result = commands.execute({ type: 'remove', id: rule.id, revision: rule.revision });
    if (!result.ok) { setNotice(result.reason); return; }
    if (loaded?.id === rule.id) setLoaded(null);
    setNotice('Saved rule removed. The open draft remains available to save again.');
  };

  const families = ['All', 'Specimen', 'Governance', 'QC', 'Biomarker'] as const;
  const palette = FACETS.filter((f) => family === 'All' || f.family === family);

  return (
    <div className="cohort-builder h-full min-h-0" data-support-pane={supportPane}>
      <nav className="cohort-builder__tools" aria-label="Cohort tools">
        <button type="button" aria-pressed={supportPane === 'facets'} aria-controls="cohort-facets" onClick={() => setSupportPane('facets')}><Plus size={11} /> Add cards</button>
        <button type="button" aria-pressed={supportPane === 'rule'} aria-controls="cohort-compiled" onClick={() => setSupportPane('rule')}><ListTree size={11} /> Rule &amp; saved</button>
      </nav>
      {/* ── Facet palette ───────────────────────────── */}
      <aside id="cohort-facets" aria-label="Facet cards" className="cohort-builder__palette border-r border-[var(--sot-shell-strong-border)]/[0.06] flex flex-col min-h-0">
        <div className="px-3 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          <div className="flex items-center gap-1.5 mb-1">
            <Filter size={11} className="text-teal-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)]">Facet cards</span>
          </div>
          <p className="text-[9px] text-[var(--sot-shell-muted)] leading-relaxed">
            Click a value to add it to the focused group, or drag a card onto any group on the canvas.
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {families.map((f) => (
              <button key={f} onClick={() => setFamily(f)}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors"
                style={{
                  borderColor: family === f ? 'rgba(56,189,248,0.5)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 10%, transparent)',
                  color: family === f ? 'var(--sot-status-info)' : 'var(--sot-shell-muted)',
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 columns-1">
            {palette.map((f) => <PaletteCard key={f.id} facet={f} onAdd={addToFocus} count={projection.countFacet} />)}
          </div>
        </ScrollArea>
      </aside>

      {/* ── Canvas ─────────────────────────────────── */}
      <section aria-label="Cohort rule editor" className="cohort-builder__editor min-w-0 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.06] flex-wrap">
          <Braces size={12} className="text-sky-400" />
          <input maxLength={COHORT_LIMITS.name} value={ruleName} onChange={(e) => setRuleName(e.target.value)}
            className="bg-transparent text-[12px] text-[var(--sot-shell-text)] focus:outline-none w-56" aria-label="Rule name" />
          <div className="flex flex-wrap items-center gap-1 ml-2">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => { edit({ type: 'open', root: p.build() }); setRuleName(p.label); setLoaded(null); setNotice(''); }}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[var(--sot-shell-strong-border)]/[0.08] text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)] hover:border-[var(--sot-shell-strong-border)]/[0.18]">
                {p.label}
              </button>
            ))}
            <button onClick={() => { edit({ type: 'open', root: { ...SEED, id: root.id, children: [] } }); }}
              className="p-1 text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-text)]" title="Clear canvas"><RotateCcw size={10} /></button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{selected.size} selected</span>
            <button disabled={selected.size < 2} onClick={() => link('AND')}
              className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border transition-colors disabled:opacity-30"
              style={{ borderColor: 'rgba(45,212,191,0.4)', color: 'var(--sot-status-success)' }}>
              <Link2 size={10} /> Link AND
            </button>
            <button disabled={selected.size < 2} onClick={() => link('OR')}
              className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border transition-colors disabled:opacity-30"
              style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--sot-status-warning)' }}>
              <Link2 size={10} /> Link OR
            </button>
            <button onClick={() => saveRule()}
              className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border transition-colors"
              style={{
                borderColor: canEdit ? 'rgba(56,189,248,0.5)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 14%, transparent)',
                color: canEdit ? 'var(--sot-status-info)' : 'var(--sot-shell-muted)',
                background: canEdit ? 'rgba(56,189,248,0.08)' : 'transparent',
              }}>
              {canEdit ? <Save size={10} /> : <Lock size={10} />} {loaded ? 'Update rule' : 'Save rule'}
            </button>
            {loaded && <button onClick={() => saveRule(true)} className="text-[9px] font-mono px-2 py-1 text-[var(--sot-shell-secondary)] underline">Save a copy</button>}
          </div>
        </div>
        <div className="cohort-builder__summary" aria-label="Current cohort counts"><span>{matches.length} matched</span><span>{eligible.length} eligible</span><span>{held.length} consent-held</span></div>
        <div role="status" aria-label="Cohort rule result" className="px-4 text-[10px] text-[var(--sot-shell-secondary)]">{editor.issue === 'limit' ? `Keep this rule within ${COHORT_LIMITS.nodes} cards and ${COHORT_LIMITS.depth} nested levels. Remove a card or unlink a group to continue.` : notice}</div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4" onClick={() => ctx.setFocus(root.id)}>
            <GroupCard node={root} ctx={ctx} depth={0} />

            {/* Result masonry */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)]">Matched cohort</span>
                <span className="text-[10px] font-mono text-teal-400">{matches.length}</span>
                <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">of {specimens.length} accessioned</span>
                <span className="ml-auto text-[9px] font-mono text-[var(--sot-shell-muted)]">
                  {eligible.length} eligible · {held.length} consent-held
                </span>
              </div>
              {matches.length === 0 ? (
                <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] border border-dashed border-[var(--sot-shell-strong-border)]/[0.06] rounded p-6 text-center">
                  No specimens satisfy this rule. Loosen a predicate or switch a group to OR.
                </div>
              ) : (
                <div className="columns-1 md:columns-2 xl:columns-3 gap-2.5">
                  {matches.map((s) => <ResultCard key={s.id} s={s} biomarkers={projection.biomarkersFor(s.id)} />)}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </section>

      {/* ── Printed rule ───────────────────────────── */}
      <aside id="cohort-compiled" aria-label="Compiled cohort rule" className="cohort-builder__compiled border-l border-[var(--sot-shell-strong-border)]/[0.06] flex flex-col min-h-0 bg-[var(--sot-shell-inset)]">
        <div className="px-3 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06]">
          <div className="flex items-center gap-1.5">
            <ListTree size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)]">Compiled rule</span>
            <span className="ml-auto text-[8px] font-mono text-[var(--sot-shell-muted)]">{countPredicates(root)} predicates</span>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-4">
            <ul className="rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.015] px-1.5 py-1">
              {root.children.length === 0
                ? <li className="text-[9px] font-mono text-[var(--sot-shell-muted)] py-2 text-center">Empty — all specimens match</li>
                : <RuleListing node={root} index={0} />}
            </ul>

            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)] mb-1">Rule expression</div>
              <pre className="text-[9px] font-mono text-[var(--sot-shell-secondary)] whitespace-pre-wrap break-words rounded border border-[var(--sot-shell-strong-border)]/[0.06] cohort-expression p-2 leading-relaxed">
                {expr}
              </pre>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { l: 'Matched', v: matches.length, c: 'var(--cohort-teal)' },
                { l: 'Eligible', v: eligible.length, c: 'var(--cohort-mint)' },
                { l: 'Held', v: held.length, c: 'var(--cohort-rose)' },
              ].map((k) => (
                <div key={k.l} className="rounded border border-[var(--sot-shell-strong-border)]/[0.06] px-2 py-1.5">
                  <div className="text-[14px] font-mono" style={{ color: k.c }}>{k.v}</div>
                  <div className="text-[8px] font-mono uppercase text-[var(--sot-shell-muted)]">{k.l}</div>
                </div>
              ))}
            </div>

            <div className="rounded border border-rose-500/25 bg-rose-500/[0.04] p-2 text-[9px] text-[var(--cohort-consent-ink)] leading-relaxed">
              <div className="flex items-center gap-1 text-rose-400 font-mono text-[8px] uppercase mb-0.5"><ShieldAlert size={9} /> Consent boundary</div>
              The Consent Registry holds specimens with rescinded, pending or expired consent (e.g. SPX-2026-0487 · well E3),
              regardless of role. They may match a rule but remain excluded from eligible cohort.
            </div>

            <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] flex items-center gap-1">
              <Lock size={8} /> {principal.name} · {role.label} · {env.label} {canEdit ? '· writes permitted' : '· read-only'}
            </div>

            <div>
              <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--sot-shell-muted)] mb-1">Saved this session</div>
              <p className="text-[9px] text-[var(--sot-shell-muted)] mb-2">Counts follow current records. Reloading the page clears saved rules.</p>
              {saved.length === 0 ? (
                <div className="text-[9px] text-[var(--sot-shell-muted)]">Save a rule to reopen it across views. Definitions last until this page reloads.</div>
              ) : (
                <div className="space-y-1.5">
                  {saved.map((r) => {
                    const current = projection.match(r.root);
                    return <div key={r.id} className="rounded border border-[var(--sot-shell-strong-border)]/[0.06]">
                      <button onClick={() => openRule(r)} aria-pressed={loaded?.id === r.id}
                        aria-label={`Open rule ${r.name}`}
                        className="w-full text-left px-2 py-1.5 hover:bg-[var(--sot-shell-text)]/[0.04] transition-colors">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--sot-shell-text)] truncate">{r.name}</span>
                          <ChevronRight size={9} className="ml-auto text-[var(--sot-shell-muted)]" />
                        </div>
                        <div className="text-[8px] font-mono text-[var(--sot-shell-muted)] truncate">{toExpression(r.root)}</div>
                        <div className="text-[8px] font-mono text-teal-400">{current.eligible.length} eligible · {current.held.length} consent-held</div>
                      </button>
                      <button onClick={() => removeRule(r)} aria-label={`Remove rule ${r.name}`}
                        className="px-2 py-1 text-[9px] font-mono text-[var(--sot-shell-muted)] hover:text-[var(--sot-status-danger)] underline">Remove</button>
                    </div>;
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}
