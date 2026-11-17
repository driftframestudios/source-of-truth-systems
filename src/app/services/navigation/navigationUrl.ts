import type { SceneMode } from "../../components/corridor/CorridorScene";
import type { StackLens } from "../../components/plate/stackLens";

const SECTION_ALIASES = {
  map: "map",
  lanes: "lanes",
  specimens: "specimens",
  cohort: "cohort",
  qc: "qc",
  biomarkers: "biomarkers",
  sources: "sources",
  requirements: "instructions",
  artifacts: "artifacts",
  comparisons: "comparisons",
  decisions: "decisions",
  "release-plan": "next-arc",
  presentations: "presentations",
  profile: "profile",
} as const;
export type AppSection = (typeof SECTION_ALIASES)[keyof typeof SECTION_ALIASES];
export interface ShareableNavigation {
  readonly section: AppSection;
  readonly scene: SceneMode;
  readonly plate: "overview" | "history";
  readonly lens: StackLens;
}
export const DEFAULT_NAVIGATION: ShareableNavigation = {
  section: "lanes",
  scene: "corridor",
  plate: "overview",
  lens: "status",
};
export const NAVIGATION_LIMITS = { query: 1024, value: 32 } as const;
const VALUES = {
  section: Object.keys(SECTION_ALIASES),
  scene: ["corridor", "plate"],
  plate: ["overview", "history"],
  lens: ["status", "kind", "storage", "athena"],
};

/** Incoming strings become navigation only after the complete finite input passes. */
export function parseNavigation(search: string): ShareableNavigation | null {
  if (search.length > NAVIGATION_LIMITS.query) return null;
  const params = new URLSearchParams(search);
  for (const [key, allowed] of Object.entries(VALUES)) {
    const values = params.getAll(key);
    if (
      values.length > 1 ||
      (values.length === 1 &&
        (values[0].length > NAVIGATION_LIMITS.value ||
          !allowed.includes(values[0])))
    )
      return null;
  }
  const section = params.get("section") as keyof typeof SECTION_ALIASES | null;
  return {
    section: section ? SECTION_ALIASES[section] : DEFAULT_NAVIGATION.section,
    scene: (params.get("scene") ?? DEFAULT_NAVIGATION.scene) as SceneMode,
    plate: (params.get("plate") ??
      DEFAULT_NAVIGATION.plate) as ShareableNavigation["plate"],
    lens: (params.get("lens") ?? DEFAULT_NAVIGATION.lens) as StackLens,
  };
}

/** Only declared finite values leave the state owners; no record or draft is serialized. */
export function serializeNavigation(value: ShareableNavigation): string {
  const params = new URLSearchParams();
  for (const key of Object.keys(VALUES) as Array<keyof ShareableNavigation>) {
    if (value[key] === DEFAULT_NAVIGATION[key]) continue;
    const text =
      key === "section"
        ? Object.keys(SECTION_ALIASES).find(
            (alias) =>
              SECTION_ALIASES[alias as keyof typeof SECTION_ALIASES] ===
              value.section,
          )
        : value[key];
    if (text && VALUES[key].includes(text)) params.set(key, text);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function navigationHistoryMode(
  previous: ShareableNavigation,
  next: ShareableNavigation,
) {
  return previous.section !== next.section || previous.scene !== next.scene
    ? "pushState"
    : "replaceState";
}
