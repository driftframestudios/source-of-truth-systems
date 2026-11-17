import { useState, useCallback } from 'react';
import type { GraphNode, GraphEdge, SourceRole, SourceStatus } from '../types';

const NODE_W = 160;
const NODE_H = 58;
const DEFAULT_VIEW_W = 1000;
const DEFAULT_VIEW_H = 580;

const ROLE_COLORS: Record<SourceRole, string> = {
  loam_context: 'var(--sot-status-success)',
  visual_authority: 'var(--sot-status-info)',
  scientific_authority: 'var(--sot-status-violet)',
  latest_refinement: 'var(--sot-status-warning)',
  generated_artifact: 'var(--sot-status-success)',
  context_only: 'var(--sot-shell-muted)',
  generation_distillation: 'var(--sot-status-info)',
};

const STATUS_RING: Record<SourceStatus, string> = {
  active: 'var(--sot-status-success)',
  stable: 'var(--sot-status-success)',
  deferred: 'var(--sot-status-warning)',
  needs_fetch: '#fb923c',
  superseded: 'var(--sot-shell-muted)',
  exploratory: 'var(--sot-status-violet)',
};

function computeEdgePath(
  nodes: ReadonlyArray<GraphNode>,
  edge: GraphEdge,
): string {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return '';

  const fromOffX = edge.fromOffsetX ?? 0;
  const toOffX = edge.toOffsetX ?? 0;

  const sameY = Math.abs(from.y - to.y) < 15;

  if (sameY) {
    const goRight = to.x > from.x;
    const sx = from.x + fromOffX + (goRight ? NODE_W / 2 : -NODE_W / 2);
    const ex = to.x + toOffX + (goRight ? -NODE_W / 2 : NODE_W / 2);
    const sy = from.y;
    const ey = to.y;
    const cy = Math.min(sy, ey) - 35;
    const mx = (sx + ex) / 2;
    return `M ${sx} ${sy} Q ${mx} ${cy} ${ex} ${ey}`;
  }

  const goDown = to.y > from.y;
  const sx = from.x + fromOffX;
  const sy = from.y + (goDown ? NODE_H / 2 : -NODE_H / 2);
  const ex = to.x + toOffX;
  const ey = to.y + (goDown ? -NODE_H / 2 : NODE_H / 2);
  const midY = (sy + ey) / 2;

  return `M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`;
}


interface Props {
  nodes: ReadonlyArray<GraphNode>;
  edges: ReadonlyArray<GraphEdge>;
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  viewW?: number;
  viewH?: number;
}

export function MapGraph({ nodes, edges, onNodeClick, selectedNodeId, viewW, viewH }: Props) {
  const VIEW_W = viewW ?? DEFAULT_VIEW_W;
  const VIEW_H = viewH ?? DEFAULT_VIEW_H;
  const gridYs: number[] = [];
  for (let gy = 120; gy < VIEW_H - 40; gy += 118) gridYs.push(gy);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const activeNode = hoveredNode ?? selectedNodeId;

  const isEdgeHighlighted = useCallback(
    (edge: GraphEdge) => {
      if (!activeNode) return true;
      return edge.from === activeNode || edge.to === activeNode;
    },
    [activeNode],
  );

  const isNodeHighlighted = useCallback(
    (nodeId: string) => {
      if (!activeNode) return true;
      if (nodeId === activeNode) return true;
      return edges.some(
        (e) =>
          (e.from === activeNode && e.to === nodeId) ||
          (e.to === activeNode && e.from === nodeId),
      );
    },
    [activeNode, edges],
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-full"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <defs>
        {edges.map((edge) => (
          <marker
            key={`arrow-${edge.id}`}
            id={`arrow-${edge.id}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={edge.color} opacity="0.9" />
          </marker>
        ))}
      </defs>

      {/* Grid lines */}
      {gridYs.map((y) => (
        <line
          key={y}
          x1="20"
          y1={y}
          x2={VIEW_W - 20}
          y2={y}
          stroke="color-mix(in srgb, var(--sot-shell-strong-border) 5%, transparent)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
      ))}

      {/* Edges */}
      {edges.map((edge) => {
        const path = computeEdgePath(nodes, edge);
        const dimmed = activeNode !== null && !isEdgeHighlighted(edge);
        const highlight = hoveredEdge === edge.id;
        const flowToPacket = edge.to === 'arc02_packet';
        return (
          <g key={edge.id}>
            <path
              id={`edgepath-${edge.id}`}
              d={path}
              fill="none"
              stroke={edge.color}
              strokeWidth={highlight ? 2.5 : 1.5}
              opacity={dimmed ? 0.12 : highlight ? 1 : 0.65}
              strokeDasharray={edge.label === 'links' ? '5 4' : undefined}
              markerEnd={`url(#arrow-${edge.id})`}
              style={{ transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHoveredEdge(edge.id)}
              onMouseLeave={() => setHoveredEdge(null)}
              className="cursor-pointer"
            />
            {/* Animated particle traversal for edges into the active packet */}
            {flowToPacket && !dimmed && (
              <>
                <circle r="3" fill={edge.color} opacity="0.95">
                  <animateMotion
                    dur={`${3 + (edge.id.charCodeAt(2) % 3)}s`}
                    repeatCount="indefinite"
                    rotate="auto"
                    keyTimes="0;1"
                    keyPoints="0;1"
                    calcMode="linear"
                  >
                    <mpath href={`#edgepath-${edge.id}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.1;0.85;1" dur={`${3 + (edge.id.charCodeAt(2) % 3)}s`} repeatCount="indefinite" />
                </circle>
                <circle r="6" fill={edge.color} opacity="0.18">
                  <animateMotion dur={`${3 + (edge.id.charCodeAt(2) % 3)}s`} repeatCount="indefinite" rotate="auto">
                    <mpath href={`#edgepath-${edge.id}`} />
                  </animateMotion>
                </circle>
              </>
            )}
            {(() => {
              const from = nodes.find((n) => n.id === edge.from);
              const to = nodes.find((n) => n.id === edge.to);
              if (!from || !to) return null;
              const fromOffX = edge.fromOffsetX ?? 0;
              const toOffX = edge.toOffsetX ?? 0;
              const sameY = Math.abs(from.y - to.y) < 15;
              let lx: number;
              let ly: number;
              if (sameY) {
                const goRight = to.x > from.x;
                const sx = from.x + fromOffX + (goRight ? NODE_W / 2 : -NODE_W / 2);
                const ex = to.x + toOffX + (goRight ? -NODE_W / 2 : NODE_W / 2);
                lx = (sx + ex) / 2;
                ly = Math.min(from.y, to.y) - 44;
              } else {
                lx = (from.x + fromOffX + to.x + toOffX) / 2;
                ly = (from.y + to.y) / 2;
              }
              if (!highlight && !isEdgeHighlighted(edge)) return null;
              return (
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  fontSize="9"
                  fill={edge.color}
                  opacity={dimmed ? 0 : 0.9}
                  style={{ fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none', transition: 'opacity 0.2s' }}
                >
                  {edge.label}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const roleColor = ROLE_COLORS[node.role];
        const statusRing = STATUS_RING[node.status];
        const dimmed = activeNode !== null && !isNodeHighlighted(node.id);
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNode;
        const active = isSelected || isHovered;

        return (
          <g
            key={node.id}
            transform={`translate(${node.x - NODE_W / 2}, ${node.y - NODE_H / 2})`}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            opacity={dimmed ? 0.2 : 1}
            onClick={() => onNodeClick?.(node.id)}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <rect
              x="0"
              y="0"
              width={NODE_W}
              height={NODE_H}
              rx="5"
              fill="var(--sot-shell-surface)"
              stroke={active ? roleColor : 'color-mix(in srgb, var(--sot-shell-strong-border) 18%, transparent)'}
              strokeWidth={active ? 1.5 : 1}
            />
            <rect
              x="0"
              y="0"
              width="4"
              height={NODE_H}
              rx="2"
              fill={roleColor}
              opacity="0.85"
            />
            <circle cx={NODE_W - 10} cy="10" r="4" fill={statusRing} opacity="0.8" />
            <text
              x="14"
              y="22"
              fontSize="11"
              fontWeight="500"
              fill="var(--sot-shell-text)"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {node.label}
            </text>
            <text
              x="14"
              y="37"
              fontSize="9"
              fill="var(--sot-shell-muted)"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {node.sublabel}
            </text>
            <text
              x="14"
              y="51"
              fontSize="9"
              fill={roleColor}
              opacity="0.7"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {node.category}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
