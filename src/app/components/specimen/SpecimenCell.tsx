import type { Specimen } from "../../types";
import { ASSAY_LABELS, words, type SpecimenColumn } from "./specimenCollection";

export function SpecimenCell({
  specimen,
  column,
}: {
  specimen: Specimen;
  column: SpecimenColumn;
}) {
  switch (column) {
    case "identity":
      return (
        <>
          <strong>{specimen.id}</strong>
          <small>{specimen.patientCode}</small>
          <span className="specimen-priority" data-priority={specimen.priority}>
            {specimen.priority}
          </span>
        </>
      );
    case "assay":
      return (
        <>
          <strong>{ASSAY_LABELS[specimen.assay] ?? specimen.assay}</strong>
          <small>{specimen.specimenType}</small>
          {specimen.plateWell && <small>Well {specimen.plateWell}</small>}
        </>
      );
    case "sample":
      return (
        <span className="specimen-state" data-kind="sample">
          {words(specimen.sampleState)}
        </span>
      );
    case "review":
      return (
        <span className="specimen-state" data-kind="review">
          {words(specimen.reviewState)}
        </span>
      );
    case "order":
      return (
        <span
          className="specimen-state"
          data-kind="order"
          data-held={specimen.orderState === "on_hold"}
        >
          {words(specimen.orderState)}
        </span>
      );
    case "quality":
      return (
        <>
          <strong
            className={
              specimen.qcFlags.length ? "specimen-table__qc" : undefined
            }
          >
            {specimen.qcFlags.length
              ? `${specimen.qcFlags.length} QC ${specimen.qcFlags.length === 1 ? "flag" : "flags"}`
              : "No QC flags"}
          </strong>
          <small>{specimen.coverage.length} recorded metrics</small>
        </>
      );
    case "history":
      return (
        <>
          <strong>{words(specimen.stage)}</strong>
          <small>{specimen.accessionedAt}</small>
        </>
      );
    case "consent":
      return (
        <>
          <span className="specimen-consent" data-status={specimen.consent}>
            {specimen.consent}
          </span>
          <small>
            {specimen.geographyCode} · {words(specimen.dataClass)}
          </small>
        </>
      );
  }
}
