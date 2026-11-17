import type { SlideSpec, Theme } from "./presentationModel";

export type FormatId = "briefing" | "evidence" | "report";
export interface FormatDefinition {
  readonly id: FormatId;
  readonly label: string;
  readonly purpose: string;
  readonly navigation: "paged" | "chapters" | "contents";
}
export const PRESENTATION_FORMATS = {
  briefing: {
    id: "briefing",
    label: "Briefing",
    purpose: "One message at a time",
    navigation: "paged",
  },
  evidence: {
    id: "evidence",
    label: "Evidence review",
    purpose: "Explore the supporting material",
    navigation: "chapters",
  },
  report: {
    id: "report",
    label: "Report",
    purpose: "Read at your own pace",
    navigation: "contents",
  },
} as const satisfies Record<FormatId, FormatDefinition>;

export interface PresentationIdentity {
  readonly id: string;
  readonly title: string;
  readonly presenter: string;
  readonly source: "curated-example" | "artifact-composition";
}
export interface PresentationSection {
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly index: number;
  readonly content: SlideSpec;
}

export function sectionTitle(slide: SlideSpec): string {
  switch (slide.kind) {
    case "title":
    case "verdict":
    case "kpi":
    case "closing":
      return slide.h1;
    case "artifact":
      return slide.artifact.title;
    default:
      return slide.h2;
  }
}

export function presentationSections(
  identity: PresentationIdentity,
  slides: ReadonlyArray<SlideSpec>,
): ReadonlyArray<PresentationSection> {
  return slides.map((content, index) => ({
    id: `${identity.id}-section-${index + 1}`,
    title: sectionTitle(content),
    label:
      content.kind === "title"
        ? "Overview"
        : content.kind === "artifact"
          ? `Artifact ${content.idx + 1}`
          : content.kicker,
    index,
    content,
  }));
}

/** Every format keeps the same position in the source-owned section sequence. */
export function sectionAt(
  index: number,
  sections: ReadonlyArray<PresentationSection>,
) {
  return sections[Math.min(sections.length - 1, Math.max(0, index))];
}

/** Evidence pages consume the same local paint roles as the other formats. */
export function presentationPaint(theme: Theme): Theme {
  return {
    ...theme,
    bg: "var(--presentation-bg)",
    surface: "var(--presentation-surface)",
    surfaceMuted: "var(--presentation-surface-muted)",
    ink: "var(--presentation-ink)",
    inkDim: "var(--presentation-muted)",
    rule: "var(--presentation-rule)",
    accent: "var(--presentation-accent)",
    accent2: "var(--presentation-accent-2)",
    accent3: "var(--presentation-accent-3)",
    accent4: "var(--presentation-accent-4)",
    accent5: "var(--presentation-accent-5)",
    textOnAccent: "var(--presentation-on-accent)",
  };
}
