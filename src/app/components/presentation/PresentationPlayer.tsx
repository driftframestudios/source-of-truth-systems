import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft } from "lucide-react";
import type { SlideSpec, Theme } from "./presentationModel";
import {
  PRESENTATION_FORMATS,
  presentationPaint,
  presentationSections,
  sectionAt,
} from "./presentationFormats";
import type {
  FormatId,
  PresentationIdentity,
  PresentationSection,
} from "./presentationFormats";
import { SectionEvidence } from "./SectionEvidence";
import "./presentation-formats.css";

type EvidenceRenderer = (
  slide: SlideSpec,
  theme: Theme,
  number: string,
  total: number,
) => ReactNode;

function ReadingSection({
  section,
  report = false,
}: {
  section: PresentationSection;
  report?: boolean;
}) {
  const content = section.content;
  const summary = "sub" in content ? content.sub : undefined;
  const Heading = report ? "h2" : "h1";
  return (
    <div
      className={
        report ? "presentation-report-section" : "presentation-briefing-page"
      }
      data-slide
    >
      <header className="presentation-message">
        <p className="presentation-eyebrow">
          {String(section.index + 1).padStart(2, "0")} / {section.label}
        </p>
        <Heading>{section.title}</Heading>
        {summary && <p className="presentation-summary">{summary}</p>}
        {content.kind === "title" && (
          <p className="presentation-summary">{content.kicker}</p>
        )}
      </header>
      <div className="presentation-support">
        <SectionEvidence content={content} />
      </div>
    </div>
  );
}

export function PresentationPlayer({
  identity,
  slides,
  theme,
  format,
  onFormatChange,
  renderEvidence,
  onExit,
}: {
  identity: PresentationIdentity;
  slides: ReadonlyArray<SlideSpec>;
  theme: Theme;
  format: FormatId;
  onFormatChange: (format: FormatId) => void;
  renderEvidence: EvidenceRenderer;
  onExit: () => void;
}) {
  const sections = useMemo(
    () => presentationSections(identity, slides),
    [identity, slides],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const current = sectionAt(activeIndex, sections);
  const scroller = useRef<HTMLDivElement>(null);
  const formatRef = useRef(format);
  const indexRef = useRef(activeIndex);
  indexRef.current = activeIndex;
  const definition = PRESENTATION_FORMATS[format];
  const paint = useMemo(() => presentationPaint(theme), [theme]);
  const variables = {
    "--presentation-bg": theme.bg,
    "--presentation-surface": theme.surface,
    "--presentation-surface-muted": theme.surfaceMuted,
    "--presentation-ink": theme.ink,
    "--presentation-muted": theme.inkDim,
    "--presentation-rule": theme.rule,
    "--presentation-accent": theme.accent,
    "--presentation-accent-2": theme.accent2,
    "--presentation-accent-3": theme.accent3,
    "--presentation-accent-4": theme.accent4,
    "--presentation-accent-5": theme.accent5,
    "--presentation-on-accent": theme.textOnAccent,
    "--presentation-display-font": theme.fontDisplay,
    "--presentation-body-font": theme.fontBody,
    "--presentation-corner": `${theme.cornerRadius}px`,
  } as CSSProperties;

  function moveTo(index: number, smooth = true) {
    const section = sectionAt(index, sections);
    if (!section) return;
    setActiveIndex(section.index);
    const root = scroller.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      `[data-section-index="${section.index}"]`,
    );
    const top =
      format === "briefing" || !target
        ? 0
        : target.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          root.scrollTop;
    root.scrollTo({
      top,
      behavior:
        smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
  }

  // A format change retains the source position, with no animated traversal of
  // sections the visitor did not choose. Paging starts each new section at top.
  useLayoutEffect(() => {
    if (formatRef.current !== format || format === "briefing")
      moveTo(indexRef.current, false);
    formatRef.current = format;
  }, [format, activeIndex]);

  useEffect(() => {
    if (format === "briefing") return;
    const root = scroller.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        setActiveIndex(sections.length - 1);
        return;
      }
      const marker =
        root.getBoundingClientRect().top + Math.min(root.clientHeight / 4, 120);
      const items = Array.from(
        root.querySelectorAll<HTMLElement>("[data-section-index]"),
      );
      const reached = items
        .filter((item) => item.getBoundingClientRect().top <= marker)
        .at(-1);
      if (reached) setActiveIndex(Number(reached.dataset.sectionIndex));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", schedule, { passive: true });
    return () => {
      root.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
    };
  }, [format, sections.length]);

  useEffect(() => {
    if (format !== "evidence" || !scroller.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) entry.target.classList.add("visible");
      },
      { root: scroller.current, threshold: 0.08 },
    );
    scroller.current
      .querySelectorAll(".presentation-slide")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [format]);

  const keyboard = useRef({ moveTo, onExit });
  keyboard.current = { moveTo, onExit };
  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (event.key === "Escape") {
        keyboard.current.onExit();
        return;
      }
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(
            "button,input,select,textarea,a,[contenteditable]",
          ))
      )
        return;
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        keyboard.current.moveTo(indexRef.current + 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        keyboard.current.moveTo(indexRef.current - 1);
      }
    }
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, []);

  if (!current) return null;

  return (
    <section
      className="presentation-player"
      data-format={format}
      style={variables}
      aria-label={`Presentation: ${identity.title}`}
    >
      <header className="presentation-player__toolbar">
        <button className="presentation-return" onClick={onExit}>
          <ChevronLeft size={15} /> Back to library
        </button>
        <div className="presentation-player__identity">
          <strong>{identity.title}</strong>
          <span>{identity.presenter} · Synthetic example</span>
        </div>
        <div
          className="presentation-format-picker"
          role="group"
          aria-label="Presentation format"
        >
          {Object.values(PRESENTATION_FORMATS).map((option) => (
            <button
              key={option.id}
              aria-pressed={format === option.id}
              title={option.purpose}
              onClick={() => onFormatChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <div className="presentation-player__workspace">
        {definition.navigation !== "paged" && (
          <nav
            className="presentation-contents"
            aria-label={
              definition.navigation === "chapters"
                ? "Presentation chapters"
                : "Report contents"
            }
          >
            <p>
              {definition.navigation === "chapters"
                ? "Review sequence"
                : "Contents"}
            </p>
            {sections.map((section) => (
              <button
                key={section.id}
                aria-current={
                  section.index === activeIndex ? "location" : undefined
                }
                onClick={() => moveTo(section.index)}
              >
                <span>{String(section.index + 1).padStart(2, "0")}</span>
                <strong>{section.label}</strong>
                {format === "report" && <small>{section.title}</small>}
              </button>
            ))}
          </nav>
        )}
        <div
          className="presentation-scroll"
          ref={scroller}
          tabIndex={0}
          aria-label={`${definition.label} content`}
        >
          <div className={`presentation-document presentation-${format}`}>
            {format === "briefing" ? (
              <ReadingSection key={current.id} section={current} />
            ) : (
              <>
                {format === "report" && (
                  <header className="presentation-report-heading">
                    <p className="presentation-eyebrow">
                      {theme.label} / Report
                    </p>
                    <h1>{identity.title}</h1>
                    <p>{identity.presenter}</p>
                  </header>
                )}
                {sections.map((section) => (
                  <section
                    key={section.id}
                    id={section.id}
                    data-section-index={section.index}
                    aria-label={section.label}
                  >
                    {format === "evidence" ? (
                      renderEvidence(
                        section.content,
                        paint,
                        String(section.index + 1).padStart(2, "0"),
                        sections.length,
                      )
                    ) : (
                      <ReadingSection section={section} report />
                    )}
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      <footer className="presentation-pagination">
        <button
          disabled={activeIndex === 0}
          onClick={() => moveTo(activeIndex - 1)}
        >
          <ArrowLeft size={15} /> Previous section
        </button>
        <span aria-live="polite">
          <strong>
            {activeIndex + 1} / {sections.length}
          </strong>{" "}
          · {current.label}
        </span>
        <button
          disabled={activeIndex === sections.length - 1}
          onClick={() => moveTo(activeIndex + 1)}
        >
          Next section <ArrowRight size={15} />
        </button>
      </footer>
    </section>
  );
}
