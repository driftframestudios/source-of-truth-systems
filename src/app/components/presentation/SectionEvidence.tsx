import type { SlideSpec } from "./presentationModel";
import { arcLabel } from "../../services/cartographyService";

/** One complete content projection, shared by the focused and reading formats. */
export function SectionEvidence({ content }: { content: SlideSpec }) {
  switch (content.kind) {
    case "title":
      return (
        <div className="presentation-cover-note">
          <strong>{content.stamp}</strong>
          <span>{content.corner}</span>
          <ul>
            {content.meta.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </div>
      );
    case "verdict":
      return (
        <aside className="presentation-callout">
          <div className="presentation-callout__label">
            <b>{content.cardNum}</b>
            <span>{content.cardLabel}</span>
          </div>
          <h3>{content.cardH3}</h3>
          <p>{content.cardP}</p>
        </aside>
      );
    case "sdlc":
      return (
        <div className="presentation-stage-evidence">
          <ol className="presentation-stages">
            {content.stages.map((stage, index) => (
              <li
                key={stage}
                data-current={index === content.here}
                aria-current={index === content.here ? "step" : undefined}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
                {index === content.here && <small>Current stage</small>}
              </li>
            ))}
          </ol>
          <aside className="presentation-callout">
            <h3>{content.cardH3}</h3>
            <p>{content.cardP}</p>
          </aside>
        </div>
      );
    case "lenses":
    case "methods":
      return (
        <ol className="presentation-evidence-list">
          {content.items.map((item) => (
            <li key={item.h}>
              <span className="presentation-item-number">
                {"n" in item ? item.n : item.num}
              </span>
              <div>
                <h3>{item.h}</h3>
                <p>{item.p}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "severity":
      return (
        <div className="presentation-risk-grid">
          {content.items.map((item) => (
            <article key={item.lbl}>
              <div>
                <b>{item.lbl}</b>
                <strong>{item.ct}</strong>
              </div>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      );
    case "cost":
      return (
        <div className="presentation-comparison-grid">
          {content.items.map((item) => (
            <article key={item.h}>
              <h3>{item.h}</h3>
              <p>{item.p}</p>
            </article>
          ))}
        </div>
      );
    case "kpi":
      return (
        <dl className="presentation-metrics">
          {content.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.num}</dd>
              {metric.note && (
                <dd className="presentation-metric-note">{metric.note}</dd>
              )}
            </div>
          ))}
        </dl>
      );
    case "timeline":
      return (
        <ol className="presentation-milestones">
          {content.milestones.map((item) => (
            <li key={item.label}>
              <span>{item.date}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.note}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "artifact":
      return (
        <div className="presentation-artifact-evidence">
          <dl className="presentation-artifact-facts">
            <div>
              <dt>Artifact</dt>
              <dd>{content.artifact.id}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{content.artifact.type}</dd>
            </div>
            <div>
              <dt>Release / revision</dt>
              <dd>
                {arcLabel(content.artifact.arc)} / {content.artifact.pass}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{content.artifact.createdAt}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{content.artifact.fileSize}</dd>
            </div>
            <div>
              <dt>Content hash</dt>
              <dd>{content.artifact.contentHash}</dd>
            </div>
          </dl>
          <p>
            {content.artifact.derivedFrom.length} upstream sources ·{" "}
            {content.artifact.changed.length} changed surfaces ·{" "}
            {content.artifact.acceptanceChecks.length} acceptance checks
            recorded.
          </p>
          {content.artifact.acceptanceChecks.length > 0 && (
            <ul className="presentation-checks">
              {content.artifact.acceptanceChecks.map((check) => (
                <li key={check.name}>
                  <strong>{check.name}</strong> · {check.result}
                  <p>{check.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "closing":
      return (
        <ol className="presentation-questions">
          {content.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
  }
}
