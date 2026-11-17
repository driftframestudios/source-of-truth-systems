import { useState } from "react";
import { FileCode, PlayCircle } from "lucide-react";
import { useArtifactCommands } from "../../services/artifactWorkflowContext";
import { ARTIFACT_PROPOSAL_LIMITS } from "../../services/artifactWorkflows";
import type {
  ArtifactProposal,
  ArtifactRecord,
} from "../../services/artifactWorkflows";

const button =
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--sot-shell-strong-border)]/[0.1] bg-[var(--sot-shell-text)]/[0.03] hover:bg-[var(--sot-shell-text)]/[0.08] text-[10px] font-mono text-[var(--sot-shell-secondary)]";
const field =
  "mt-1 w-full rounded border border-[var(--sot-shell-strong-border)]/[0.15] bg-[var(--sot-shell-raised)] p-2 text-[10px] text-[var(--sot-shell-text)]";

function ProposalForm({
  record,
  proposal,
}: {
  record: ArtifactRecord;
  proposal: ArtifactProposal;
}) {
  const execute = useArtifactCommands();
  const [title, setTitle] = useState(proposal.title);
  const [change, setChange] = useState(proposal.change);
  return (
    <form
      className="space-y-3"
      aria-label="Revision proposal"
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          type: "save",
          id: record.id,
          revision: record.revision,
          title,
          change,
        });
      }}
    >
      <label className="block text-[10px] text-[var(--sot-shell-secondary)]">
        Proposal title
        <input
          className={field}
          required
          maxLength={ARTIFACT_PROPOSAL_LIMITS.title}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="block text-[10px] text-[var(--sot-shell-secondary)]">
        Planned change
        <textarea
          className={field}
          required
          rows={3}
          maxLength={ARTIFACT_PROPOSAL_LIMITS.change}
          value={change}
          onChange={(event) => setChange(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={button} type="submit">
          Save proposal
        </button>
        <button
          className={button}
          type="button"
          onClick={() =>
            execute({
              type: "discard",
              id: record.id,
              revision: record.revision,
            })
          }
        >
          Discard proposal
        </button>
      </div>
    </form>
  );
}

export function ArtifactOperations({ record }: { record: ArtifactRecord }) {
  const execute = useArtifactCommands();
  return (
    <section aria-label="Local artifact work" className="mb-4 space-y-3">
      <div className="flex gap-2 flex-wrap">
        {!record.proposal && (
          <button
            className={button}
            onClick={() =>
              execute({
                type: "prepare",
                id: record.id,
                revision: record.revision,
              })
            }
          >
            <FileCode size={10} /> Prepare revision
          </button>
        )}
        <button
          className={button}
          onClick={() =>
            execute({ type: "check", id: record.id, revision: record.revision })
          }
        >
          <PlayCircle size={10} /> Check local references
        </button>
      </div>
      <p className="text-[9px] text-[var(--sot-shell-muted)]">
        Local metadata only. Recorded files and acceptance findings stay
        unchanged.
      </p>
      {record.proposal && (
        <div className="rounded border border-sky-500/20 bg-sky-500/5 p-3">
          <div className="text-[10px] font-mono text-sky-300 mb-1">
            Revision proposal · metadata only
          </div>
          <p className="text-[9px] text-[var(--sot-shell-muted)] mb-3">
            Based on {record.title}, revision {record.pass}.
          </p>
          <ProposalForm
            key={`${record.id}:${record.proposal.title}:${record.proposal.change}`}
            record={record}
            proposal={record.proposal}
          />
        </div>
      )}
      {record.localChecks && (
        <div
          aria-label="Local reference results"
          className="space-y-2 rounded border border-[var(--sot-shell-strong-border)]/[0.1] p-3"
        >
          <p
            role="status"
            className="text-[10px] font-mono text-[var(--sot-shell-secondary)]"
          >
            {
              record.localChecks.filter((check) => check.result === "pass")
                .length
            }
            /{record.localChecks.length} local checks passed
          </p>
          {record.localChecks.map((check) => (
            <div key={check.key} className="flex items-start gap-2 text-[9px]">
              <span
                style={{
                  color:
                    check.result === "pass"
                      ? "var(--sot-status-success)"
                      : "var(--sot-status-danger)",
                }}
                aria-label={check.result === "pass" ? "Passed" : "Failed"}
              >
                {check.result === "pass" ? "✓" : "✗"}
              </span>
              <div>
                <div className="text-[var(--sot-shell-secondary)]">
                  {check.name}
                </div>
                <div className="text-[var(--sot-shell-muted)]">
                  {check.note}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ArtifactLocalSummary({ record }: { record: ArtifactRecord }) {
  return (
    <div
      className="space-y-1 text-[9px] text-[var(--sot-shell-secondary)]"
      aria-label={`Local work for ${record.title}`}
    >
      {record.proposal && <div>Proposal: {record.proposal.title}</div>}
      {record.localChecks && (
        <div>
          {record.localChecks.filter((check) => check.result === "pass").length}
          /{record.localChecks.length} local checks passed
        </div>
      )}
    </div>
  );
}
