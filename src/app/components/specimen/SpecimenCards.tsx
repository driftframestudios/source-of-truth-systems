import { Activity, Dna, MapPin } from "lucide-react";
import type { Specimen } from "../../types";
import { ASSAY_LABELS, words, type SpecimenTopic } from "./specimenCollection";
import {
  SpecimenConsentNotice,
  SpecimenCoverage,
  SpecimenQualityFlags,
  SpecimenTimeline,
  SpecimenWorkflow,
} from "./SpecimenDetails";

export type OpenSpecimenTopic = (
  specimen: Specimen,
  topic: SpecimenTopic,
  trigger: HTMLButtonElement,
) => void;
export function SpecimenCards({
  specimens,
  onOpen,
}: {
  specimens: readonly Specimen[];
  onOpen: OpenSpecimenTopic;
}) {
  return (
    <div className="specimen-masonry" aria-label="Specimen cards">
      {specimens.map((specimen) => (
        <article
          key={specimen.id}
          data-specimen-id={specimen.id}
          data-consent={specimen.consent}
          className="specimen-card"
          aria-label={`${specimen.id} card`}
        >
          <SpecimenConsentNotice specimen={specimen} />
          <div className="specimen-card__body">
            <header>
              <div>
                <button
                  className="specimen-card__identity"
                  onClick={(event) =>
                    onOpen(specimen, "context", event.currentTarget)
                  }
                  aria-label={specimen.id}
                >
                  <Dna size={13} aria-hidden="true" />
                  {specimen.id}
                </button>
                <p>
                  {specimen.patientCode} ·{" "}
                  {ASSAY_LABELS[specimen.assay] ?? specimen.assay}
                </p>
              </div>
              <span
                className="specimen-priority"
                data-priority={specimen.priority}
              >
                {specimen.priority}
              </span>
            </header>
            <p className="specimen-card__indication">{specimen.indication}</p>
            <p className="specimen-card__material">{specimen.specimenType}</p>
            <div className="specimen-card__meta">
              <span>
                <MapPin size={10} aria-hidden="true" />
                {specimen.geographyCode}
              </span>
              <span>{words(specimen.dataClass)}</span>
              {specimen.plateWell && <span>Well {specimen.plateWell}</span>}
              {typeof specimen.tumorPercent === "number" && (
                <span>Tumor {specimen.tumorPercent}%</span>
              )}
              {typeof specimen.variantsCalled === "number" && (
                <span>
                  <Activity size={10} aria-hidden="true" />
                  {specimen.variantsCalled} variants
                </span>
              )}
            </div>
            <button
              className="specimen-card__consent specimen-consent"
              data-status={specimen.consent}
              onClick={(event) =>
                onOpen(specimen, "consent", event.currentTarget)
              }
            >
              Consent {specimen.consent}
              <span> · {specimen.consentSetBy}</span>
            </button>
            <SpecimenQualityFlags specimen={specimen} />
            <section className="specimen-card__section">
              <h3>
                <button
                  onClick={(event) =>
                    onOpen(specimen, "quality", event.currentTarget)
                  }
                >
                  Coverage &amp; quality <span aria-hidden="true">↗</span>
                </button>
              </h3>
              <SpecimenCoverage specimen={specimen} />
            </section>
            <section className="specimen-card__section">
              <h3>
                <button
                  onClick={(event) =>
                    onOpen(specimen, "history", event.currentTarget)
                  }
                >
                  Recorded timeline <span aria-hidden="true">↗</span>
                </button>
                <span>{words(specimen.stage)}</span>
              </h3>
              <SpecimenTimeline specimen={specimen} />
            </section>
            {specimen.note && (
              <p className="specimen-card__note">{specimen.note}</p>
            )}
            <section className="specimen-card__section">
              <h3>Workflow</h3>
              <SpecimenWorkflow specimen={specimen} />
            </section>
          </div>
        </article>
      ))}
    </div>
  );
}
