import { useReleaseRecords } from '../../services/releaseWorkflowContext';
import { sourceRoleLabel } from '../../services/cartographyService';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Layers, Compass, Ruler, BookOpen, Shield, ArrowLeftRight, GitBranch, ChevronRight, Lock, FlaskConical, Beaker, ClipboardCheck, ShoppingCart } from 'lucide-react';
import { MapGraph } from '../MapGraph';
import { InstructionStatusBadge, ArcBadge, PriorityDot, SourceStatusBadge } from '../StatusBadge';
import { ScrollArea } from '../ui/scroll-area';
import { STORE } from '../../data';
import { useSourceRecords } from '../../services/sourceSessionContext';
import { useWriteGate } from '../../services/writeGate';
import { useEnvironment } from '../../services/environment';
import { useMapOperations } from '../../services/mapOperationsContext';
import { mapActions } from '../../services/mapOperations';
import type { MapAction } from '../../services/mapOperations';
import {
  REVIEW_FLOW, SAMPLE_FLOW, ORDER_FLOW,
} from '../../types';
import type {
  Landmark, GraphNode, LabState,
} from '../../types';

const GRAPH_VIEW_W = 1700;
const GRAPH_VIEW_H = 1200;
const LAB_LABELS: Record<LabState, string> = {
  wet_lab: 'Wet Lab', dry_lab: 'Dry Lab', interpretation: 'Interpretation', infrastructure: 'Infrastructure',
};

const ICON_MAP: Record<string, LucideIcon> = {
  Layers,
  Compass,
  Ruler,
  BookOpen,
  Shield,
  ArrowLeftRight,
  GitBranch,
};

function LandmarkCard({ landmark }: { landmark: Landmark }) {
  const Icon = ICON_MAP[landmark.iconName] ?? Layers;
  const source = useSourceRecords().find(source => source.id === landmark.sourceId);
  return (
    <div className="flex gap-3 p-3 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.04] transition-colors group">
      <div className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center bg-sky-500/10 border border-sky-500/20 mt-0.5">
        <Icon size={13} className="text-sky-400" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-[var(--sot-shell-text)]">{landmark.name}</div>
        <div className="text-[10px] text-[var(--sot-shell-muted)] mt-0.5 leading-relaxed">{landmark.role}</div>
        {source && (
          <div className="text-[9px] text-[var(--sot-shell-muted)] mt-1 font-mono truncate">{sourceRoleLabel(source.role)}</div>
        )}
      </div>
    </div>
  );
}

function StateTrack({ label, Icon, value, flow, actions, allowed, onAct, accent }: {
  label: string; Icon: LucideIcon; value: string; flow: ReadonlyArray<string>;
  actions: ReadonlyArray<MapAction>; allowed: (action: MapAction) => boolean;
  onAct: (action: MapAction) => void; accent: string;
}) {
  const fmt = (value: string) => value.replace(/_/g, ' ');
  return <div className="py-1" role="group" aria-label={label + ' workflow'}>
    <div className="flex items-center gap-2">
      <Icon size={11} className="text-[var(--sot-shell-muted)] flex-shrink-0" />
      <span className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider w-14 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-wrap flex-1">
        {flow.map(state => <span key={state} className="text-[8px] font-mono px-1 py-0.5 rounded"
          style={{ background: state === value ? 'color-mix(in srgb, ' + accent + ' 13.333%, transparent)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 5%, transparent)', color: state === value ? accent : 'var(--sot-shell-muted)', border: state === value ? '1px solid color-mix(in srgb, ' + accent + ' 33.333%, transparent)' : '1px solid transparent' }}>{fmt(state)}</span>)}
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5 mt-1 ml-5">
      {actions.map(action => {
        const canAct = allowed(action);
        return <button key={action.command.event} onClick={() => onAct(action)}
          className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors"
          style={{ color: canAct ? accent : 'var(--sot-shell-muted)', borderColor: canAct ? 'color-mix(in srgb, ' + accent + ' 33.333%, transparent)' : 'color-mix(in srgb, var(--sot-shell-strong-border) 12%, transparent)' }}>
          {!canAct && <Lock size={8} />}→ {action.label}
        </button>;
      })}
      {actions.length === 0 && <span className="text-[8px] font-mono text-[var(--sot-shell-muted)]">Complete</span>}
    </div>
  </div>;
}

function NodeDetail({ node }: { node: GraphNode }) {
  const { env } = useEnvironment();
  const source = useSourceRecords().find(source => source.id === node.id);
  const { commands } = useMapOperations();
  const writeGate = useWriteGate();
  const actions = mapActions(node);
  const canEdit = actions.some(action => commands.check(action.command).ok);
  const onAct = (action: MapAction) => {
    const result = commands.execute(action.command);
    if (!result.ok) writeGate.deny(action.label, result, node.id);
  };
  const hasControls = node.reviewState || node.sampleState || node.orderState;

  return (
    <div className="border-t border-[var(--sot-shell-strong-border)]/[0.06] px-4 py-3 bg-[var(--sot-shell-surface)] max-h-[42%] overflow-y-auto">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--sot-shell-text)] truncate">{source?.title ?? node.label}</span>
            {node.system && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--sot-shell-text)]/[0.04] text-[var(--sot-shell-muted)] border border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">{node.system}</span>
            )}
          </div>
          <div className="text-[10px] text-[var(--sot-shell-muted)] mt-0.5 leading-relaxed">{node.description ?? source?.description}</div>
          <div className="mt-1.5 flex gap-3 flex-wrap text-[9px] font-mono text-[var(--sot-shell-muted)]">
            {node.owner && <span>owner: <span className="text-[var(--sot-shell-muted)]">{node.owner}</span></span>}
            {node.geographyCode && <span>geo: <span className="text-[var(--sot-shell-muted)]">{node.geographyCode}</span></span>}
            {node.dataClass && <span>class: <span className="text-[var(--sot-shell-muted)]">{node.dataClass.replace(/_/g, ' ')}</span></span>}
            {node.category && <span>kind: <span className="text-[var(--sot-shell-muted)]">{node.category}</span></span>}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {source && <SourceStatusBadge status={source.status} />}
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
        </div>
      </div>

      {source && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {source.trustScope.map((d) => (
            <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">{d.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      {node.labState && <div className="mt-2 text-[9px] font-mono text-[var(--sot-shell-muted)] flex items-center gap-1.5"><Beaker size={10} />Work area · {LAB_LABELS[node.labState]}</div>}
      {hasControls && <div className="mt-2.5 pt-2.5 border-t border-[var(--sot-shell-strong-border)]/[0.05]">
        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider mb-1">Workflow example · retained in this session</div>
        {node.sampleState && <StateTrack label="sample" Icon={FlaskConical} value={node.sampleState} flow={SAMPLE_FLOW} actions={actions.filter(a => a.command.type === 'sample')} allowed={action => commands.check(action.command).ok} onAct={onAct} accent="#38bdf8" />}
        {node.reviewState && <StateTrack label="review" Icon={ClipboardCheck} value={node.reviewState} flow={REVIEW_FLOW} actions={actions.filter(a => a.command.type === 'review')} allowed={action => commands.check(action.command).ok} onAct={onAct} accent="#a78bfa" />}
        {node.orderState && <StateTrack label="order" Icon={ShoppingCart} value={node.orderState} flow={ORDER_FLOW} actions={actions.filter(a => a.command.type === 'order')} allowed={action => commands.check(action.command).ok} onAct={onAct} accent="#f59e0b" />}
      </div>}
    </div>
  );
}

export function MapView() {
  const { requirements } = useReleaseRecords();
  const sources = useSourceRecords();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { nodes } = useMapOperations();
  const activeInstructions = requirements.filter((i) => i.status === 'active').slice(0, 6);
  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Arc Status Bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-background)]/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--sot-shell-muted)] font-mono uppercase tracking-wider">Current release</span>
          <ArcBadge arc="arc_02" />
        </div>
        <div className="w-px h-4 bg-[var(--sot-shell-text)]/10" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--sot-shell-muted)] font-mono uppercase tracking-wider">Target</span>
          <span className="text-[11px] text-[var(--sot-shell-text)]">Platform Discipline — Pipeline Stages · VPC Containment · S3 Lineage</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span className="text-[10px] text-[var(--sot-shell-muted)]">{requirements.filter((i) => i.status === 'active').length} active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-[var(--sot-shell-muted)]">{requirements.filter((i) => i.status === 'deferred').length} deferred</span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Graph panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 border-r border-[var(--sot-shell-strong-border)]/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Source Relationship Graph · {STORE.graphNodes.length} nodes</span>
            {selectedNode && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--sot-shell-muted)]">Selected:</span>
                <span className="text-[11px] text-[var(--sot-shell-text)] font-mono">{selectedNodeId}</span>
                <button onClick={() => setSelectedNodeId(null)} className="text-[10px] text-[var(--sot-shell-muted)] hover:text-[var(--sot-shell-muted)]">✕</button>
              </div>
            )}
          </div>
          <div role="region" aria-label="Source relationship graph" tabIndex={0} className="flex-1 min-h-0 overflow-auto map-scroll">
            <div className="p-4" style={{ width: GRAPH_VIEW_W, height: GRAPH_VIEW_H }}>
              <MapGraph
                nodes={nodes}
                edges={STORE.graphEdges}
                viewW={GRAPH_VIEW_W}
                viewH={GRAPH_VIEW_H}
                onNodeClick={(id) => setSelectedNodeId((prev) => (prev === id ? null : id))}
                selectedNodeId={selectedNodeId}
              />
            </div>
          </div>

          {/* Selected node detail + operational controls */}
          {selectedNode && <NodeDetail key={selectedNode.id} node={selectedNode} />}
        </div>

        {/* Right panel */}
        <div role="region" aria-label="Map references" className="w-72 flex flex-col min-h-0 flex-shrink-0">
          {/* Release requirements */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
            <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Release requirements</span>
            <span className="text-[10px] text-[var(--sot-shell-muted)]">{activeInstructions.length} of {requirements.filter(i => i.status === 'active').length}</span>
          </div>
          <ScrollArea role="region" aria-label="Map release requirements" className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              {activeInstructions.map((instr) => (
                <div key={instr.id} className="p-2.5 rounded border border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02]">
                  <div className="flex items-start gap-2">
                    <PriorityDot priority={instr.priority} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{instr.id}</span>
                        <InstructionStatusBadge status={instr.status} />
                      </div>
                      <p className="text-[10px] text-[var(--sot-shell-text)] leading-relaxed">{instr.text}</p>
                      <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">
                        Source: {sources.find(source => source.id === instr.sourceId)?.title ?? "Source unavailable"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Landmarks */}
          <div className="border-t border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--sot-shell-strong-border)]/[0.05]">
              <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Landmarks</span>
            </div>
            <ScrollArea role="region" aria-label="Map landmarks" className="h-56">
              <div className="p-3 space-y-1.5">
                {STORE.landmarks.map((lm) => (
                  <LandmarkCard key={lm.id} landmark={lm} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Artifact Strip */}
      <div role="region" aria-label="Artifact lineage" className="border-t border-[var(--sot-shell-strong-border)]/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[10px] font-mono text-[var(--sot-shell-muted)] uppercase tracking-wider">Artifact Lineage Strip</span>
          <ChevronRight size={12} className="text-[var(--sot-shell-muted)]" />
        </div>
        <div className="flex gap-3 px-4 pb-3 overflow-x-auto">
          {STORE.artifacts.map((artifact, idx) => {
            const passScore = artifact.acceptanceChecks.filter((c) => c.result === 'pass').length;
            const total = artifact.acceptanceChecks.length;
            const isLatest = idx === STORE.artifacts.length - 1;
            return (
              <div
                key={artifact.id}
                className={`flex-shrink-0 w-36 rounded border p-2.5 cursor-pointer transition-colors ${
                  isLatest
                    ? 'border-sky-500/40 bg-sky-500/10'
                    : 'border-[var(--sot-shell-strong-border)]/[0.06] bg-[var(--sot-shell-text)]/[0.02] hover:bg-[var(--sot-shell-text)]/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ArcBadge arc={artifact.arc} />
                  <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">Rev {artifact.pass}</span>
                </div>
                <div className="text-[9px] text-[var(--sot-shell-muted)] font-mono truncate mb-1.5">{artifact.title}</div>
                <div className="flex items-center gap-1">
                  <div className="flex-1 h-1 rounded-full bg-[var(--sot-shell-text)]/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: total > 0 ? `${(passScore / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-[var(--sot-shell-muted)]">{passScore}/{total}</span>
                </div>
                <div className="text-[9px] text-[var(--sot-shell-muted)] mt-1">{artifact.createdAt}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
