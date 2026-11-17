import type { Lane, LaneCard, LaneCardKind, LaneId } from "../../types";

export const CORRIDOR_STAGES: ReadonlyArray<{
  id: Lane["stage"];
  label: string;
  color: string;
}> = [
  { id: "wet_lab", label: "Wet lab", color: "#e8d36a" },
  { id: "dry_lab", label: "Dry lab", color: "#7aab6a" },
  { id: "interpretation", label: "Interpretation", color: "#c99eae" },
];
export const CARD_KINDS: ReadonlyArray<LaneCardKind> = [
  "process",
  "state_major",
  "state_minor",
  "control",
  "nested",
];
export interface CorridorView {
  mode: "lane" | "overview";
  stage: "all" | Lane["stage"];
  hidden: ReadonlySet<LaneId>;
  hideKinds: ReadonlySet<LaneCardKind>;
  query: string;
  showArrows: boolean;
}
export const INITIAL_CORRIDOR_VIEW: CorridorView = {
  mode: "lane",
  stage: "all",
  hidden: new Set(),
  hideKinds: new Set(),
  query: "",
  showArrows: true,
};
/** Overview needs extra reach to inspect one placard within the full corridor. */
export const MOBILE_CORRIDOR_ZOOM = {
  min: 0.65,
  lane: 2.5,
  overview: 6,
} as const;
export const INITIAL_MOBILE_CAMERA = {
  panX: 0,
  panY: 0,
  zoom: 1,
  pitch: 54,
  yaw: 0,
};
export type MobileCorridorCamera = typeof INITIAL_MOBILE_CAMERA;

/** Filters compose before the shared renderer resolves relationships. */
export function selectCorridorView(
  lanes: ReadonlyArray<Lane>,
  cards: ReadonlyArray<LaneCard>,
  view: CorridorView,
  laneId: LaneId,
) {
  const visibleLanes = lanes.filter(
    (lane) =>
      !view.hidden.has(lane.id) &&
      (view.mode === "lane"
        ? lane.id === laneId
        : view.stage === "all" || lane.stage === view.stage),
  );
  const ids = new Set(visibleLanes.map((lane) => lane.id));
  const order = new Map(visibleLanes.map((lane, index) => [lane.id, index]));
  const query = view.query.trim().toLowerCase();
  const visibleCards = cards
    .filter(
      (card) =>
        ids.has(card.laneId) &&
        !view.hideKinds.has(card.kind) &&
        (!query ||
          [card.label, card.note, card.id, card.laneId].some((text) =>
            text?.toLowerCase().includes(query),
          )),
    )
    .sort(
      (a, b) =>
        order.get(a.laneId)! - order.get(b.laneId)! || a.position - b.position,
    );
  return { lanes: visibleLanes, cards: visibleCards };
}
export function toggleSet<T>(items: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(items);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
