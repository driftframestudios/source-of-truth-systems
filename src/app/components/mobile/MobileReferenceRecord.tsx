import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { arcLabel, authorityDomainLabel, comparisonModeLabel, referenceTitle, recordTitle, sourceRoleLabel, sourceTypeLabel, sourceStatusLabel } from '../../services/cartographyService';
import { STORE } from "../../data";
import type { Source, Instruction, Decision } from "../../types";
import { useArtifactRecords } from "../../services/artifactWorkflowContext";
import type { ArtifactRecord } from "../../services/artifactWorkflows";
import { useReleaseRecords } from "../../services/releaseWorkflowContext";
import { useSourceRecords } from "../../services/sourceSessionContext";
import { resolveRecordTarget } from "../../services/recordNavigation";
import type { RecordTarget } from "../../services/recordNavigation";

type DetailGroup = { label: string; items: ReadonlyArray<string> };
type RecordDisplay = {
  title: string;
  text?: string;
  facts: ReadonlyArray<readonly [string, string]>;
  groups?: ReadonlyArray<DetailGroup>;
};
const words = (value: string) => value.replace(/_/g, " ");

// Each receiver owns its readable fields; exact identity is shared with desktop.
function describeRecord(target: RecordTarget, sources: ReadonlyArray<Source>, requirements: ReadonlyArray<Instruction>, decisions: ReadonlyArray<Decision>, artifacts: ReadonlyArray<ArtifactRecord>): RecordDisplay | null {
  switch (target.section) {
    case "sources": {
      const record = sources.find((item) => item.id === target.entityId);
      return record
        ? {
            title: record.title,
            text: record.description,
            facts: [
              ["Type", sourceTypeLabel(record.type)],
              ["Role", sourceRoleLabel(record.role)],
              ["Status", sourceStatusLabel(record.status)],
              ["Source updated", record.lastUpdated],
              ["Confidence", `${record.confidenceScore}%`],
            ],
            groups: [
              { label: "Authority scope", items: record.trustScope.map(authorityDomainLabel) },
              {
                label: "Outside its authority",
                items: record.notAuthoritativeFor.map(authorityDomainLabel),
              },
              { label: "Tags", items: record.tags },
            ],
          }
        : null;
    }
    case "instructions": {
      const record = requirements.find(
        (item) => item.id === target.entityId,
      );
      return record
        ? {
            title: record.id,
            text: record.text,
            facts: [
              ["Status", words(record.status)],
              ["Category", record.category],
              ["Priority", record.priority],
              ["Release", arcLabel(record.arc)],
              ["Source", sources.find(source => source.id === record.sourceId)?.title ?? recordTitle("sources", record.sourceId)],
            ],
            groups: [
              { label: "Rationale", items: [record.reason] },
              { label: "Applies to", items: record.appliesTo },
            ],
          }
        : null;
    }
    case "artifacts": {
      const record = artifacts.find(
        (item) => item.id === target.entityId,
      );
      return record
        ? {
            title: record.title,
            facts: [
              ["Type", record.type],
              ["Release", arcLabel(record.arc)],
              ["Revision", String(record.pass)],
              ["Created", record.createdAt],
              ["Size", record.fileSize],
              ["Content hash", record.contentHash],
            ],
            groups: [
              { label: "Changed", items: record.changed },
              { label: "Deferred", items: record.deferred },
              { label: "Derived from", items: record.derivedFrom.map(id => sources.find(source => source.id === id)?.title ?? referenceTitle(id)) },
              { label: "Revision proposal", items: record.proposal ? [record.proposal.title, record.proposal.change] : [] },
              { label: "Local reference checks", items: record.localChecks?.map(check => `${check.name} · ${check.result}. ${check.note}`) ?? [] },
              {
                label: "Acceptance checks",
                items: record.acceptanceChecks.map(
                  (check) => `${check.name} · ${check.result}. ${check.note}`,
                ),
              },
            ],
          }
        : null;
    }
    case "comparisons": {
      const record = STORE.comparisons.find(
        (item) => item.id === target.entityId,
      );
      return record
        ? {
            title: record.topic,
            text: record.resolution,
            facts: [
              ["Mode", comparisonModeLabel(record.mode)],
              ["Resolution", record.resolutionStatus],
              ["Release", arcLabel(record.arc)],
            ],
            groups: [record.itemA, record.itemB].map((item) => ({
              label: item.entityLabel,
              items: [
                item.statement,
                words(item.itemStatus),
              ],
            })),
          }
        : null;
    }
    case "decisions": {
      const record = decisions.find(
        (item) => item.id === target.entityId,
      );
      return record
        ? {
            title: record.title,
            text: record.rationale,
            facts: [
              ["Status", record.status],
              ["Category", record.category],
              ["Date", record.date],
              ["Release", arcLabel(record.arc)],
            ],
            groups: [{ label: "Sources", items: record.sourceIds.map(id => sources.find(source => source.id === id)?.title ?? recordTitle("sources", id)) }],
          }
        : null;
    }
  }
}

export function MobileReferenceRecord({
  target,
  onBack,
}: {
  target: RecordTarget;
  onBack: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const sources = useSourceRecords();
  const artifacts = useArtifactRecords();
  const { requirements, decisions } = useReleaseRecords();
  const resolved = resolveRecordTarget(target, STORE);
  const record =
    resolved.status === "found" ? describeRecord(resolved.target, sources, requirements, decisions, artifacts) : null;
  useEffect(() => {
    root.current?.focus();
    root.current?.scrollIntoView({ block: "start" });
  }, [target]);
  return (
    <div className="mobile-reference-record" ref={root} tabIndex={-1}>
      <button className="mobile-corridor-reference-back" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to workflow record
      </button>
      <p className="mobile-corridor-eyebrow">
        {target.section}
      </p>
      <h2 id="mobile-corridor-detail-title">
        {record?.title ?? "Record unavailable"}
      </h2>
      {record ? (
        <>
          {record.text && <p>{record.text}</p>}
          <dl className="mobile-corridor-detail-facts">
            {record.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {record.groups
            ?.filter((group) => group.items.length)
            .map((group) => (
              <section key={group.label}>
                <h3>{group.label}</h3>
                <ul>
                  {group.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
        </>
      ) : (
        <p role="status">
          This linked record is absent from the current example. Return to the
          workflow record to continue.
        </p>
      )}
    </div>
  );
}
