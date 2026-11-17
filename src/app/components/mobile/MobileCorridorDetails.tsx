import { recordTitle } from '../../services/cartographyService';
import { lazy, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { STORE } from "../../data";
import type { CardCrossRefs, Lane, LaneCard } from "../../types";
import type {
  RecordSection,
  RecordTarget,
} from "../../services/recordNavigation";
import { cardStyle, FLAG_STYLE } from "../corridor/CorridorScene";
import { DeferredView } from "../DeferredView";

const MobileReferenceRecord = lazy(() =>
  import("./MobileReferenceRecord").then(({ MobileReferenceRecord }) => ({
    default: MobileReferenceRecord,
  })),
);
const REFERENCE_SECTIONS = {
  sourceIds: "sources",
  instructionIds: "instructions",
  artifactIds: "artifacts",
  comparisonIds: "comparisons",
  decisionIds: "decisions",
} as const;

export function MobileCardDetail({
  card,
  lane,
  cards,
  onClose,
  onSelect,
}: {
  card: LaneCard;
  lane: Lane;
  cards: ReadonlyArray<LaneCard>;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [target, setTarget] = useState<RecordTarget | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTarget(null);
  }, [card.id]);
  function returnToCard() {
    setTarget(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  const style = cardStyle(card.kind);
  const index = cards.findIndex((item) => item.id === card.id);
  const references = (
    Object.entries(REFERENCE_SECTIONS) as Array<
      [keyof CardCrossRefs, RecordSection]
    >
  ).flatMap(([key, section]) =>
    (card.crossRefs?.[key] ?? []).map((entityId) => ({ section, entityId })),
  );
  const stream = STORE.streams.find((item) => item.id === card.streamRef);
  if (target)
    return (
      <div className="mobile-corridor-detail-inner">
        <DeferredView label="linked record">
          <MobileReferenceRecord target={target} onBack={returnToCard} />
        </DeferredView>
      </div>
    );
  return (
    <div className="mobile-corridor-detail-inner" ref={titleRef} tabIndex={-1}>
      <header className="mobile-corridor-detail-heading">
        <span>
          {lane.label} · {String(index + 1).padStart(2, "0")} /{" "}
          {String(cards.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          autoFocus
          aria-label="Close step details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div
        className="mobile-corridor-detail-card"
        style={{
          background: style.bg,
          color: style.fg,
          borderColor: style.topStripe,
        }}
      >
        <span>{style.label} · workflow record</span>
        <h2 id="mobile-corridor-detail-title">{card.label}</h2>
        {card.note && <p>{card.note}</p>}
        {!!card.nested?.length && (
          <div className="mobile-corridor-nested">
            {card.nested.map((entry) => (
              <span key={entry.id} title={entry.id}>
                {entry.label} <small>{entry.id}</small>
              </span>
            ))}
          </div>
        )}
      </div>
      <dl className="mobile-corridor-detail-facts">
        <div>
          <dt>Record ID</dt>
          <dd>{card.id}</dd>
        </div>
        {card.artifactRef && (
          <div>
            <dt>Artifact</dt>
            <dd>{card.artifactRef}</dd>
          </div>
        )}
        <div>
          <dt>Along the lane</dt>
          <dd>{Math.round(card.position * 100)}%</dd>
        </div>
        {stream && (
          <div>
            <dt>Data stream</dt>
            <dd>
              {stream.label} · {stream.format}
              <br />
              {stream.approxSize}
            </dd>
          </div>
        )}
        {card.contaminationProb != null && (
          <div>
            <dt>Contamination probability</dt>
            <dd>{Math.round(card.contaminationProb * 100)}%</dd>
          </div>
        )}
      </dl>
      {!!card.pennants?.length && (
        <div className="mobile-corridor-detail-tags">
          {card.pennants.map((pennant, i) => (
            <span key={`${pennant.kind}-${i}`}>
              {pennant.kind === "qc"
                ? "Quality control"
                : pennant.kind === "review"
                  ? "Review"
                  : pennant.kind.toUpperCase()}{" "}
              · {pennant.label}
            </span>
          ))}
        </div>
      )}
      {references.length > 0 && (
        <div className="mobile-corridor-references">
          <h3>Linked records</h3>
          {references.map((reference) => (
            <button
              className="mobile-corridor-reference-link"
              key={`${reference.section}-${reference.entityId}`}
              onClick={() => setTarget(reference)}
            >
              <span>{reference.section}</span>
              <strong>{recordTitle(reference.section, reference.entityId)}</strong>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      )}
      <footer className="mobile-corridor-detail-footer">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onSelect(cards[index - 1].id)}
        >
          <ChevronLeft size={17} />
          Previous step
        </button>
        <button
          type="button"
          disabled={index === cards.length - 1}
          onClick={() => onSelect(cards[index + 1].id)}
        >
          Next step
          <ChevronRight size={17} />
        </button>
      </footer>
    </div>
  );
}

export function MobileLaneDetail({
  lane,
  onSelect,
  onClose,
}: {
  lane: Lane;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const cards = STORE.laneCards.filter((card) => card.laneId === lane.id);
  const flags = STORE.laneFlags.filter((flag) => flag.laneId === lane.id);
  const streams = STORE.streams.filter(
    (stream) =>
      stream.producedByLane === lane.id || stream.consumedByLane === lane.id,
  );
  const connections = STORE.connections.filter(
    (connection) => connection.laneId === lane.id,
  );
  return (
    <div className="mobile-corridor-detail-inner mobile-corridor-explorer">
      <header className="mobile-corridor-detail-heading">
        <h2 id="mobile-corridor-detail-title">{lane.label}</h2>
        <button autoFocus aria-label="Close lane details" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <p>{lane.description}</p>
      <p className="mobile-corridor-eyebrow">{lane.stage.replace("_", " ")}</p>
      <h3>Workflow records</h3>
      {cards.map((card) => (
        <button
          key={card.id}
          className="mobile-corridor-reference-link"
          onClick={() => onSelect(card.id)}
        >
          <i style={{ background: cardStyle(card.kind).bg }} />
          <strong>{card.label}</strong>
          <span>{Math.round(card.position * 100)}%</span>
          <ArrowUpRight size={15} />
        </button>
      ))}
      {!!flags.length && (
        <details>
          <summary>Flags · {flags.length}</summary>
          {flags.map((flag) => (
            <div
              className="mobile-corridor-related"
              key={flag.id}
              style={{ borderLeft: `3px solid ${FLAG_STYLE[flag.kind].bg}` }}
            >
              <strong>{flag.label}</strong>
              <span>
                {flag.kind} · {Math.round(flag.position * 100)}%
              </span>
              {flag.sublabel && <p>{flag.sublabel}</p>}
            </div>
          ))}
        </details>
      )}
      <details>
        <summary>Connections · {connections.length}</summary>
        {connections.length ? (
          connections.map((connection) => (
            <div className="mobile-corridor-related" key={connection.id}>
              <strong>{connection.label}</strong>
              <span>
                {connection.online ? "Online" : "Offline"} · {connection.vendor}
              </span>
              <p>{connection.purpose}</p>
              {connection.authRequired && (
                <small>Authentication required</small>
              )}
            </div>
          ))
        ) : (
          <p>No connections in this lane.</p>
        )}
      </details>
      <details>
        <summary>Streams · {streams.length}</summary>
        {streams.map((stream) => (
          <div className="mobile-corridor-related" key={stream.id}>
            <strong>{stream.label}</strong>
            <span>
              {stream.format} · {stream.approxSize}
            </span>
            <p>
              {stream.producedByLane === lane.id
                ? "Produced here"
                : "Received here"}
            </p>
          </div>
        ))}
      </details>
      <details>
        <summary>Surface labels</summary>
        {STORE.laneSurfaceLabels
          .filter((label) => label.laneId === lane.id)
          .map((label) => (
            <p key={label.id}>
              {label.text} · {Math.round(label.position * 100)}%
            </p>
          ))}
      </details>
    </div>
  );
}
