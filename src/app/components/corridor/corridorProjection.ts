import type { Lane, LaneArrow, LaneCard, LaneFlag, LaneSurfaceLabel } from '../../types';

/** Resolve relationships from the same visible population that supplies cards. */
export function projectCorridor(
  lanes: ReadonlyArray<Pick<Lane, 'id'>>,
  cards: ReadonlyArray<LaneCard>,
  arrows: ReadonlyArray<LaneArrow>,
) {
  const laneIds = new Set(lanes.map((lane) => lane.id));
  const visibleCards = cards.filter((card) => laneIds.has(card.laneId));
  const cardsById = new Map(visibleCards.map((card) => [card.id, card]));
  const connections = arrows.flatMap((arrow) => {
    const from = cardsById.get(arrow.fromCardId);
    const to = cardsById.get(arrow.toCardId);
    return from && to ? [{ arrow, from, to }] : [];
  });
  return { cards: visibleCards, connections };
}

export const LANE_LENGTH_PX = 2640;
export const LANE_WIDTH_PX = 140;
export const LANE_GAP_PX = 16;

/** Ordered paint records and keyed geometry share the same visible snapshot. */
export function projectCorridorGeometry(
  lanes: ReadonlyArray<Lane>, cards: ReadonlyArray<LaneCard>, arrows: ReadonlyArray<LaneArrow>,
  flags: ReadonlyArray<LaneFlag>, labels: ReadonlyArray<LaneSurfaceLabel>,
) {
  const visible = projectCorridor(lanes, cards, arrows);
  const rows = lanes.map((lane, index) => ({
    lane, yOff: (index - (lanes.length - 1) / 2) * (LANE_WIDTH_PX + LANE_GAP_PX),
    cards: [] as LaneCard[], flags: [] as LaneFlag[], surfaceLabels: [] as LaneSurfaceLabel[],
  }));
  const byLane = new Map(rows.map(row => [row.lane.id, row]));
  for (const card of visible.cards) byLane.get(card.laneId)!.cards.push(card);
  for (const flag of flags) byLane.get(flag.laneId)?.flags.push(flag);
  for (const label of labels) byLane.get(label.laneId)?.surfaceLabels.push(label);
  const connections = visible.connections.map(({ arrow, from, to }) => {
    const fx = from.position * LANE_LENGTH_PX - LANE_LENGTH_PX / 2;
    const tx = to.position * LANE_LENGTH_PX - LANE_LENGTH_PX / 2;
    const fy = byLane.get(from.laneId)!.yOff;
    const ty = byLane.get(to.laneId)!.yOff;
    const cy = Math.min(fy, ty) - Math.abs(ty - fy) * 0.4 - 30;
    return { arrow, path: `M ${fx} ${fy - 20} Q ${(fx + tx) / 2 + (tx - fx) * 0.1} ${cy} ${tx} ${ty - 20}` };
  });
  return { rows, connections };
}
