import type { LucideIcon } from "lucide-react";
import type { Artifact } from "../../types";

export type Band = "source" | "scientific" | "visual" | "exec";

export type ThemeId =
  | "bold-signal"
  | "deep-meridian"
  | "spectrum"
  | "blueprint"
  | "clinic-mono"
  | "gestalt-bloom";

export interface Theme {
  readonly id: ThemeId;
  readonly label: string;
  readonly blurb: string;
  readonly audience: string;
  readonly bg: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly ink: string;
  readonly inkDim: string;
  readonly rule: string;
  readonly accent: string;
  readonly accent2: string;
  readonly accent3: string;
  readonly accent4: string;
  readonly accent5: string;
  readonly textOnAccent: string;
  readonly fontDisplay: string;
  readonly fontBody: string;
  readonly cornerRadius: number;
  readonly slideOverlay?: string; // optional decorative overlay
  readonly icon: LucideIcon;
}

export type SlideSpec =
  | TitleSlide
  | VerdictSlide
  | SdlcSlide
  | LensesSlide
  | SeveritySlide
  | CostSlide
  | MethodsSlide
  | KpiSlide
  | TimelineSlide
  | ArtifactSlide
  | ClosingSlide;

interface TitleSlide {
  kind: "title";
  kicker: string;
  h1: string;
  meta: ReadonlyArray<string>;
  stamp: string;
  corner: string;
}
interface VerdictSlide {
  kind: "verdict";
  kicker: string;
  h1: string;
  sub: string;
  cardNum: string;
  cardLabel: string;
  cardH3: string;
  cardP: string;
}
interface SdlcSlide {
  kind: "sdlc";
  kicker: string;
  h2: string;
  sub: string;
  stages: ReadonlyArray<string>;
  here: number;
  cardH3: string;
  cardP: string;
}
interface LensesSlide {
  kind: "lenses";
  kicker: string;
  h2: string;
  sub: string;
  items: ReadonlyArray<{ n: string; h: string; p: string }>;
}
interface SeveritySlide {
  kind: "severity";
  kicker: string;
  h2: string;
  sub: string;
  items: ReadonlyArray<{ lbl: string; ct: string; desc: string }>;
}
interface CostSlide {
  kind: "cost";
  kicker: string;
  h2: string;
  sub: string;
  items: ReadonlyArray<{ h: string; p: string }>;
}
interface MethodsSlide {
  kind: "methods";
  kicker: string;
  h2: string;
  sub: string;
  items: ReadonlyArray<{ num: string; h: string; p: string }>;
}
interface KpiSlide {
  kind: "kpi";
  kicker: string;
  h1: string;
  sub: string;
  metrics: ReadonlyArray<{ num: string; label: string; note?: string }>;
}
interface TimelineSlide {
  kind: "timeline";
  kicker: string;
  h2: string;
  sub: string;
  milestones: ReadonlyArray<{ date: string; label: string; note: string }>;
}
interface ArtifactSlide {
  kind: "artifact";
  band: Band;
  artifact: Artifact;
  idx: number;
}
interface ClosingSlide {
  kind: "closing";
  kicker: string;
  h1: string;
  sub: string;
  items: ReadonlyArray<string>;
}
