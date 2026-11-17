import {
  Activity,
  ClipboardCheck,
  FlaskConical,
  Lock,
  ShoppingCart,
} from "lucide-react";
import { useEnvironment } from "../../services/environment";
import { useRecordCommands } from "../../services/recordSessionContext";
import { useWriteGate } from "../../services/writeGate";
import { isConsentHold } from "../../services/accessService";
import {
  meetsSpecimenTarget,
  specimenTargetLabel,
} from "../../services/specimenQuality";
import {
  orderTransitions,
  reviewTransitions,
  sampleTransitions,
} from "../../services/recordSession";
import type { RecordSessionAction } from "../../services/recordSession";
import { ORDER_FLOW, REVIEW_FLOW, SAMPLE_FLOW } from "../../types";
import type { Specimen } from "../../types";
import { WorkflowStepper } from "../WorkflowStepper";
import { useTheme } from "../../theme/ThemeProvider";
import {
  ASSAY_LABELS,
  TOPICS,
  words,
  type SpecimenTopic,
} from "./specimenCollection";

export function SpecimenCoverage({ specimen }: { specimen: Specimen }) {
  return (
    <div className="specimen-coverage-list">
      {specimen.coverage.length ? (
        specimen.coverage.map((bar) => (
          <div
            className="specimen-coverage"
            key={bar.label}
            data-met={meetsSpecimenTarget(bar)}
          >
            <div>
              <span>{bar.label}</span>
              <strong>
                {bar.value}
                {bar.unit ?? ""} <small>· {specimenTargetLabel(bar)}</small>
              </strong>
            </div>
            <div className="specimen-coverage__track" aria-hidden="true">
              <span
                style={{ width: `${Math.max(0, Math.min(100, bar.value))}%` }}
              />
              <i
                style={{ left: `${Math.max(0, Math.min(100, bar.target))}%` }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="specimen-detail__note">Coverage not recorded.</p>
      )}
    </div>
  );
}
export function SpecimenTimeline({ specimen }: { specimen: Specimen }) {
  return (
    <ol className="specimen-timeline">
      {specimen.timeline.map((step, index) => (
        <li key={`${step.label}-${index}`} data-complete={step.done}>
          <span className="specimen-timeline__dot" aria-hidden="true" />
          <span>
            {step.label}
            <span className="sr-only">
              {" "}
              · {step.done ? "complete" : "pending"}
            </span>
          </span>
          <span className="specimen-timeline__date">
            {step.at || "Not dated"}
          </span>
        </li>
      ))}
    </ol>
  );
}
export function SpecimenQualityFlags({ specimen }: { specimen: Specimen }) {
  return (
    <div className="specimen-qc" aria-label="Quality flags">
      {specimen.qcFlags.length ? (
        specimen.qcFlags.map((flag) => <span key={flag}>{flag}</span>)
      ) : (
        <span data-clear="true">No QC flags</span>
      )}
    </div>
  );
}
export function SpecimenConsentNotice({ specimen }: { specimen: Specimen }) {
  return isConsentHold(specimen.consent) ? (
    <p className="specimen-detail__hold">
      <Lock size={13} aria-hidden="true" />
      Consent {specimen.consent} — analysis held
    </p>
  ) : null;
}

/** Cards and the topic dialog use one set of accepted-record actions. */
export function SpecimenWorkflow({
  specimen,
  topic,
}: {
  specimen: Specimen;
  topic?: "sample" | "review" | "order";
}) {
  const { env } = useEnvironment();
  const { theme } = useTheme();
  const commands = useRecordCommands();
  const writeGate = useWriteGate();
  const advance = (label: string, action: RecordSessionAction) => {
    const result = commands.execute(action);
    if (!result.ok) writeGate.deny(`${label} advance`, result, specimen.id);
  };
  return (
    <section
      className="specimen-detail__workflow"
      aria-label={`${specimen.id} workflow`}
    >
      <p className="specimen-detail__note">
        {env.label} · Actions follow the current role and specimen consent.
      </p>
      {(!topic || topic === "sample") && (
        <WorkflowStepper
          label="sample"
          Icon={FlaskConical}
          value={specimen.sampleState}
          flow={SAMPLE_FLOW}
          actions={sampleTransitions(specimen.sampleState)}
          checkAction={(event) => commands.check({ type: "specimen.sample", id: specimen.id, event })}
          accent={theme.status.info}
          onAction={(event) =>
            advance("Sample", {
              type: "specimen.sample",
              id: specimen.id,
              event,
            })
          }
        />
      )}
      {(!topic || topic === "review") && (
        <WorkflowStepper
          label="review"
          Icon={ClipboardCheck}
          value={specimen.reviewState}
          flow={REVIEW_FLOW}
          actions={reviewTransitions(specimen.reviewState)}
          checkAction={(event) => commands.check({ type: "specimen.review", id: specimen.id, event })}
          accent={theme.status.violet}
          onAction={(event) =>
            advance("Review", {
              type: "specimen.review",
              id: specimen.id,
              event,
            })
          }
        />
      )}
      {(!topic || topic === "order") && (
        <WorkflowStepper
          label="order"
          Icon={ShoppingCart}
          value={specimen.orderState}
          flow={ORDER_FLOW}
          actions={orderTransitions(specimen.orderState)}
          checkAction={(event) => commands.check({ type: "specimen.order", id: specimen.id, event })}
          accent={theme.status.warning}
          onAction={(event) =>
            advance("Order", { type: "specimen.order", id: specimen.id, event })
          }
        />
      )}
      <p className="specimen-detail__note">
        Sample and order actions · laboratory role. Clinical review · reviewer role and clinical clearance.
      </p>
    </section>
  );
}
function Facts({ children }: { children: React.ReactNode }) {
  return <dl className="specimen-facts">{children}</dl>;
}
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SpecimenDetails({
  specimen,
  topic,
}: {
  specimen: Specimen;
  topic: SpecimenTopic;
}) {
  return (
    <section
      className="specimen-detail"
      aria-label={`${specimen.id} ${TOPICS[topic]}`}
    >
      <SpecimenConsentNotice specimen={specimen} />
      {topic === "context" && (
        <>
          <p className="specimen-detail__lead">{specimen.indication}</p>
          <Facts>
            <Fact label="Patient">{specimen.patientCode}</Fact>
            <Fact label="Assay">
              {ASSAY_LABELS[specimen.assay] ?? specimen.assay}
            </Fact>
            <Fact label="Material">{specimen.specimenType}</Fact>
            <Fact label="Priority">{specimen.priority}</Fact>
            <Fact label="Plate well">
              {specimen.plateWell ?? "Not assigned"}
            </Fact>
            <Fact label="Accessioned">{specimen.accessionedAt}</Fact>
            {typeof specimen.tumorPercent === "number" && (
              <Fact label="Tumor">{specimen.tumorPercent}%</Fact>
            )}
            {typeof specimen.variantsCalled === "number" && (
              <Fact label="Variants called">{specimen.variantsCalled}</Fact>
            )}
          </Facts>
          {specimen.note && (
            <p className="specimen-detail__note">{specimen.note}</p>
          )}
        </>
      )}
      {(["sample", "review", "order"] as const).map(
        (kind) =>
          topic === kind && (
            <SpecimenWorkflow key={kind} specimen={specimen} topic={kind} />
          ),
      )}
      {topic === "quality" && (
        <>
          <SpecimenCoverage specimen={specimen} />
          <SpecimenQualityFlags specimen={specimen} />
          <p className="specimen-detail__note">
            <Activity size={13} aria-hidden="true" /> Targets describe these
            examples; QC flags remain separate recorded findings.
          </p>
        </>
      )}
      {topic === "history" && (
        <>
          <Facts>
            <Fact label="Recorded stage">{words(specimen.stage)}</Fact>
            <Fact label="Accessioned">{specimen.accessionedAt}</Fact>
          </Facts>
          <SpecimenTimeline specimen={specimen} />
          <p className="specimen-detail__note">
            This dated history describes the recorded example journey. Workflow
            tabs show the current local state.
          </p>
        </>
      )}
      {topic === "consent" && (
        <>
          <Facts>
            <Fact label="Consent">
              <span className="specimen-consent" data-status={specimen.consent}>
                {specimen.consent}
              </span>
            </Fact>
            <Fact label="Consent source">{specimen.consentSetBy}</Fact>
            <Fact label="Data class">{words(specimen.dataClass)}</Fact>
            <Fact label="Region">{specimen.geographyCode}</Fact>
            <Fact label="Accession">{specimen.id}</Fact>
            <Fact label="Plate well">
              {specimen.plateWell ?? "Not assigned"}
            </Fact>
          </Facts>
          <p className="specimen-detail__note">
            These are synthetic showcase records. Consent restrictions remain in
            force when exploring local operations.
          </p>
        </>
      )}
    </section>
  );
}
