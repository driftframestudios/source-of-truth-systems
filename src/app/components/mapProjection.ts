import type { GraphNode, GraphEdge } from '../types';
export const NODE_W = 160;
export const NODE_H = 58;

function computeEdgePath(
  from: GraphNode, to: GraphNode, edge: GraphEdge,
): string {
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


export function projectMapGraph(nodes: ReadonlyArray<GraphNode>, edges: ReadonlyArray<GraphEdge>) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const neighbors = new Map<string, Set<string>>();
  const connections = edges.flatMap(edge => {
    const from = byId.get(edge.from), to = byId.get(edge.to);
    if (!from || !to) return [];
    for (const [a, b] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      let adjacent = neighbors.get(a);
      if (!adjacent) { adjacent = new Set(); neighbors.set(a, adjacent); }
      adjacent.add(b);
    }
    const fromOffX = edge.fromOffsetX ?? 0, toOffX = edge.toOffsetX ?? 0;
    const sameY = Math.abs(from.y - to.y) < 15;
    const goRight = to.x > from.x;
    const sx = from.x + fromOffX + (goRight ? NODE_W / 2 : -NODE_W / 2);
    const ex = to.x + toOffX + (goRight ? -NODE_W / 2 : NODE_W / 2);
    return [{ edge, path: computeEdgePath(from, to, edge),
      lx: sameY ? (sx + ex) / 2 : (from.x + fromOffX + to.x + toOffX) / 2,
      ly: sameY ? Math.min(from.y, to.y) - 44 : (from.y + to.y) / 2 }];
  });
  return { connections, neighbors };
}
