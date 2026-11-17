import type { CSSProperties, ReactNode } from 'react';
import type { StatusPalette } from '../theme/palettes';
import './record-badge.css';
import type {
  SourceStatus, SourceRole, SourceType,
  InstructionStatus, InstructionCategory,
  AcceptanceResult, ArcId, RelationshipType,
} from '../types';
import { arcLabel, sourceRoleLabel, sourceStatusLabel } from '../services/cartographyService';
import { cn } from './ui/utils';

interface BadgeProps {
  className?: string;
}

const BASE = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase border whitespace-nowrap font-mono';

type BadgeTone = keyof StatusPalette | 'neutral';
interface BadgePaint {
  tone: BadgeTone;
  classes: string;
}

/** Labels retain domain meaning; Light ink comes from the shared semantic palette. */
function RecordBadge({ paint, className, children }: BadgeProps & { paint: BadgePaint; children: ReactNode }) {
  const ink = paint.tone === 'neutral' ? 'var(--sot-shell-secondary)' : `var(--sot-status-${paint.tone})`;
  return (
    <span
      className={cn(BASE, paint.classes, 'record-badge', className)}
      style={{ '--record-badge-ink': ink } as CSSProperties}
    >{children}</span>
  );
}

export function SourceStatusBadge({ status, className }: BadgeProps & { status: SourceStatus }) {
  const styles: Record<SourceStatus, BadgePaint> = {
    active: { tone: 'success', classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
    stable: { tone: 'info', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    deferred: { tone: 'warning', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    needs_fetch: { tone: 'warning', classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
    superseded: { tone: 'neutral', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    exploratory: { tone: 'violet', classes: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  };
  return <RecordBadge paint={styles[status]} className={className}>{sourceStatusLabel(status)}</RecordBadge>;
}

export function SourceRoleBadge({ role, className }: BadgeProps & { role: SourceRole }) {
  const styles: Record<SourceRole, BadgePaint> = {
    loam_context: { tone: 'success', classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
    visual_authority: { tone: 'info', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    scientific_authority: { tone: 'violet', classes: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
    latest_refinement: { tone: 'warning', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    generated_artifact: { tone: 'success', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    context_only: { tone: 'neutral', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    generation_distillation: { tone: 'info', classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  };
  return <RecordBadge paint={styles[role]} className={className}>{sourceRoleLabel(role)}</RecordBadge>;
}

export function SourceTypeBadge({ type, className }: BadgeProps & { type: SourceType }) {
  const styles: Record<SourceType, BadgePaint> = {
    notion_page: { tone: 'violet', classes: 'bg-pink-500/10 text-pink-300 border-pink-500/25' },
    uploaded_file: { tone: 'warning', classes: 'bg-amber-500/10 text-amber-300 border-amber-500/25' },
    generated_svg: { tone: 'success', classes: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' },
    scientific_ref: { tone: 'violet', classes: 'bg-violet-500/10 text-violet-300 border-violet-500/25' },
    exemplar_image: { tone: 'warning', classes: 'bg-orange-500/10 text-orange-300 border-orange-500/25' },
    planning_page: { tone: 'info', classes: 'bg-sky-500/10 text-sky-300 border-sky-500/25' },
    yaml_manifest: { tone: 'info', classes: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25' },
    json_manifest: { tone: 'violet', classes: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25' },
  };
  const labels: Record<SourceType, string> = {
    notion_page: 'S3 Doc',
    uploaded_file: 'Uploaded',
    generated_svg: 'SVG',
    scientific_ref: 'Scientific',
    exemplar_image: 'Exemplar',
    planning_page: 'Planning',
    yaml_manifest: 'YAML',
    json_manifest: 'JSON',
  };
  return <RecordBadge paint={styles[type]} className={className}>{labels[type]}</RecordBadge>;
}

export function InstructionStatusBadge({ status, className }: BadgeProps & { status: InstructionStatus }) {
  const styles: Record<InstructionStatus, BadgePaint> = {
    active: { tone: 'success', classes: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
    deferred: { tone: 'warning', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    superseded: { tone: 'neutral', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    target_state: { tone: 'info', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  };
  const labels: Record<InstructionStatus, string> = {
    active: 'Active',
    deferred: 'Deferred',
    superseded: 'Superseded',
    target_state: 'Target State',
  };
  return <RecordBadge paint={styles[status]} className={className}>{labels[status]}</RecordBadge>;
}

export function InstructionCategoryBadge({ category, className }: BadgeProps & { category: InstructionCategory }) {
  const styles: Record<InstructionCategory, BadgePaint> = {
    geometric: { tone: 'info', classes: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
    aesthetic: { tone: 'violet', classes: 'bg-pink-500/10 text-pink-300 border-pink-500/20' },
    scientific: { tone: 'violet', classes: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
    accessibility: { tone: 'success', classes: 'bg-green-500/10 text-green-300 border-green-500/20' },
    rendering_order: { tone: 'warning', classes: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
    operational: { tone: 'neutral', classes: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
    typography: { tone: 'danger', classes: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  };
  const labels: Record<InstructionCategory, string> = {
    geometric: 'Geometric',
    aesthetic: 'Aesthetic',
    scientific: 'Scientific',
    accessibility: 'Accessibility',
    rendering_order: 'Render Order',
    operational: 'Operational',
    typography: 'Typography',
  };
  return <RecordBadge paint={styles[category]} className={className}>{labels[category]}</RecordBadge>;
}

export function AcceptanceBadge({ result, className }: BadgeProps & { result: AcceptanceResult }) {
  const styles: Record<AcceptanceResult, BadgePaint> = {
    pass: { tone: 'success', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    fail: { tone: 'danger', classes: 'bg-red-500/15 text-red-300 border-red-500/30' },
    review: { tone: 'warning', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    pending: { tone: 'neutral', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  };
  const labels: Record<AcceptanceResult, string> = {
    pass: '✓ Pass',
    fail: '✗ Fail',
    review: '~ Review',
    pending: '· Pending',
  };
  return <RecordBadge paint={styles[result]} className={className}>{labels[result]}</RecordBadge>;
}

export function ArcBadge({ arc, className }: BadgeProps & { arc: ArcId }) {
  const styles: Record<ArcId, BadgePaint> = {
    arc_01: { tone: 'neutral', classes: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
    arc_02: { tone: 'info', classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
    arc_03: { tone: 'violet', classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
    future: { tone: 'violet', classes: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  };
  return <RecordBadge paint={styles[arc]} className={className}>{arcLabel(arc)}</RecordBadge>;
}

export function RelationshipBadge({ type, color, className }: BadgeProps & { type: RelationshipType; color: string }) {
  return (
    <span
      className={cn(BASE, className)}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 9.412%, transparent)`, color, borderColor: `color-mix(in srgb, ${color} 25.098%, transparent)` }}
    >
      {type}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = { high: '#f87171', medium: '#f59e0b', low: 'var(--sot-shell-muted)' };
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: colors[priority] }}
      title={priority}
    />
  );
}
