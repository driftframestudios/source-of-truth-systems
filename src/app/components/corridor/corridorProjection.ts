import type { Lane, LaneArrow, LaneCard } from '../../types';

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
