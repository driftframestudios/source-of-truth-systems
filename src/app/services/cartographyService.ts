import { STORE } from '../data';
import type { RecordSection } from './recordNavigation';
import type {
  Source, Instruction, Artifact, Comparison, Decision,
  SourceType, SourceRole, SourceStatus,
  InstructionStatus, InstructionCategory, ArcId,
  CartographyStore, AuthorityDomain, GenerationPacket,
} from '../types';

function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export function getStore(): CartographyStore {
  return STORE;
}

export function getSourceById(id: string): Source | undefined {
  return STORE.sources.find((s) => s.id === id);
}

export function getSourcesByType(type: SourceType): ReadonlyArray<Source> {
  return STORE.sources.filter((s) => s.type === type);
}

export function getSourcesByRole(role: SourceRole): ReadonlyArray<Source> {
  return STORE.sources.filter((s) => s.role === role);
}

export function getSourcesByStatus(status: SourceStatus): ReadonlyArray<Source> {
  return STORE.sources.filter((s) => s.status === status);
}

export function getInstructionById(id: string): Instruction | undefined {
  return STORE.instructions.find((i) => i.id === id);
}

export function getInstructionsByStatus(status: InstructionStatus): ReadonlyArray<Instruction> {
  return STORE.instructions.filter((i) => i.status === status);
}

export function getInstructionsByCategory(category: InstructionCategory): ReadonlyArray<Instruction> {
  return STORE.instructions.filter((i) => i.category === category);
}

export function getInstructionsByArc(arc: ArcId): ReadonlyArray<Instruction> {
  return STORE.instructions.filter((i) => i.arc === arc);
}

export function getArtifactsByArc(arc: ArcId): ReadonlyArray<Artifact> {
  return STORE.artifacts.filter((a) => a.arc === arc);
}

export function getArtifactById(id: string): Artifact | undefined {
  return STORE.artifacts.find((a) => a.id === id);
}

export function getComparisonsByMode(mode: Comparison['mode']): ReadonlyArray<Comparison> {
  return STORE.comparisons.filter((c) => c.mode === mode);
}

export function getDecisionsByArc(arc: ArcId): ReadonlyArray<Decision> {
  return STORE.decisions.filter((d) => d.arc === arc);
}

export function getRelationshipsFrom(sourceId: string) {
  return STORE.relationships.filter((r) => r.fromId === sourceId);
}

export function getRelationshipsTo(targetId: string) {
  return STORE.relationships.filter((r) => r.toId === targetId);
}

export function getActiveInstructions(): ReadonlyArray<Instruction> {
  return STORE.instructions.filter((i) => i.status === 'active');
}

export function getDeferredInstructions(): ReadonlyArray<Instruction> {
  return STORE.instructions.filter((i) => i.status === 'deferred');
}

export function getActiveSources(): ReadonlyArray<Source> {
  return STORE.sources.filter((s) => s.status === 'active' || s.status === 'stable');
}

export function sourceTypeLabel(type: SourceType): string {
  switch (type) {
    case 'notion_page': return 'Program Doc (S3)';
    case 'uploaded_file': return 'Uploaded File';
    case 'generated_svg': return 'Generated SVG';
    case 'scientific_ref': return 'Scientific Ref';
    case 'exemplar_image': return 'Exemplar Image';
    case 'planning_page': return 'Planning Page';
    case 'yaml_manifest': return 'YAML Manifest';
    case 'json_manifest': return 'JSON Manifest';
    default: return assertNever(type);
  }
}

export function sourceRoleLabel(role: SourceRole): string {
  switch (role) {
    case 'loam_context': return 'Program context';
    case 'visual_authority': return 'Design specification';
    case 'scientific_authority': return 'Scientific Authority';
    case 'latest_refinement': return 'Delivery update';
    case 'generated_artifact': return 'Generated Artifact';
    case 'context_only': return 'Context Only';
    case 'generation_distillation': return 'Release specification';
    default: return assertNever(role);
  }
}

export function sourceStatusLabel(status: SourceStatus): string {
  switch (status) {
    case 'active': return 'Active';
    case 'deferred': return 'Deferred';
    case 'needs_fetch': return 'Refresh needed';
    case 'superseded': return 'Superseded';
    case 'stable': return 'Stable';
    case 'exploratory': return 'Exploratory';
    default: return assertNever(status);
  }
}

export function instructionStatusLabel(status: InstructionStatus): string {
  switch (status) {
    case 'active': return 'Active';
    case 'deferred': return 'Deferred';
    case 'superseded': return 'Superseded';
    case 'target_state': return 'Target State';
    default: return assertNever(status);
  }
}

export function arcLabel(arc: ArcId): string {
  switch (arc) {
    case 'arc_01': return 'Release 01';
    case 'arc_02': return 'Release 02';
    case 'arc_03': return 'Release 03';
    case 'future': return 'Future';
    default: return assertNever(arc);
  }
}


// Display vocabulary changes independently of stored IDs and route keys.
const AUTHORITY_DOMAIN_LABELS: Readonly<Record<AuthorityDomain, string>> = {
  diagram_purpose: 'Workflow purpose', current_posture: 'Program priorities',
  geometric_grammar: 'Pipeline structure', aesthetic_nuance: 'Presentation context',
  scientific_terminology: 'Scientific terminology', visual_orientation: 'Workflow design',
  generation_instructions: 'Release requirements', latest_human_refinements: 'Delivery updates',
  artifact_state: 'Recorded revision', intended_target: 'Planned outcome', process_labels: 'Workflow labels',
};
const COMPARISON_MODE_LABELS: Readonly<Record<Comparison['mode'], string>> = {
  source_vs_source: 'Source vs source', instruction_vs_artifact: 'Requirement vs artifact',
  artifact_vs_exemplar: 'Artifact vs specification', arc_vs_arc: 'Release vs release',
  target_vs_current: 'Planned vs current',
};

export function authorityDomainLabel(domain: AuthorityDomain): string {
  return AUTHORITY_DOMAIN_LABELS[domain];
}

export function comparisonModeLabel(mode: Comparison['mode']): string {
  return COMPARISON_MODE_LABELS[mode];
}

export function recordTitle(section: RecordSection, id: string): string {
  switch (section) {
    case 'sources': return getSourceById(id)?.title ?? 'Source unavailable';
    case 'instructions': return getInstructionById(id)?.id ?? 'Requirement unavailable';
    case 'artifacts': return getArtifactById(id)?.title ?? 'Artifact unavailable';
    case 'comparisons': return STORE.comparisons.find(record => record.id === id)?.topic ?? 'Comparison unavailable';
    case 'decisions': return STORE.decisions.find(record => record.id === id)?.title ?? 'Decision unavailable';
    default: return assertNever(section);
  }
}

/** Relationships may connect sources and artifacts; source identity wins their shared baseline ID. */
export function referenceTitle(id: string): string {
  return getSourceById(id)?.title ?? getArtifactById(id)?.title ?? getInstructionById(id)?.id
    ?? STORE.decisions.find(record => record.id === id)?.title ?? 'Reference unavailable';
}


/** A read-only projection of the current plan, never a build or deployment result. */
export function releasePlanSummary(packet: GenerationPacket, accepted?: { sources: ReadonlyArray<Source>; requirements: ReadonlyArray<Instruction> }): string {
  return [
    packet.arcLabel, packet.objective,
    `Sources (${packet.activeSources.length})`,
    ...packet.activeSources.map(id => `• ${accepted ? accepted.sources.find(source => source.id === id)?.title ?? 'Source unavailable' : recordTitle('sources', id)}`),
    `Requirements (${packet.activeInstructions.length})`,
    ...packet.activeInstructions.map(id => {
      const requirement = accepted ? accepted.requirements.find(record => record.id === id) : getInstructionById(id);
      return `• ${requirement?.text ?? 'Requirement unavailable'}${accepted && requirement ? ` [${instructionStatusLabel(requirement.status)} · ${arcLabel(requirement.arc)}]` : ''}`;
    }),
    'Review checks', ...packet.validationChecks.map(check => `• ${check}`),
    'Deferred work', ...packet.deferred.map(item => `• ${item}`),
  ].join('\n');
}
