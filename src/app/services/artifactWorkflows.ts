import type { Artifact, Source } from "../types";
import type { CommandPermission, CommandResult } from "./command";
import { commandRefusal, identifyRefusal } from "./command";
import type { PermissionDecision } from "./permissionPolicy";

export interface ArtifactLocalCheck {
  readonly key: string;
  readonly name: string;
  readonly result: "pass" | "fail";
  readonly note: string;
}
export interface ArtifactProposal {
  readonly parentId: string;
  readonly title: string;
  readonly change: string;
}
export type ArtifactRecord = Artifact & {
  readonly revision: number;
  readonly localChecks?: ReadonlyArray<ArtifactLocalCheck>;
  readonly proposal?: ArtifactProposal;
};
export interface ArtifactWorkflows {
  readonly byId: Readonly<Record<string, ArtifactRecord>>;
}
type Identity = { readonly id: string; readonly revision: number };
export type ArtifactCommand = Identity &
  (
    | { readonly type: "check" | "prepare" | "discard" }
    | { readonly type: "save"; readonly title: string; readonly change: string }
  );
const TYPES = new Set(["svg", "png", "pdf", "yaml", "json", "markdown"]);
const RELEASES = new Set(["arc_01", "arc_02", "arc_03", "future"]);
const ACTIONS = new Set<ArtifactCommand["type"]>([
  "check",
  "prepare",
  "save",
  "discard",
]);
export const ARTIFACT_PROPOSAL_LIMITS = { title: 120, change: 500 } as const;
const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function createArtifactWorkflows(
  artifacts: ReadonlyArray<Artifact>,
): ArtifactWorkflows {
  return {
    byId: Object.fromEntries(
      artifacts.map((record) => [record.id, { ...record, revision: 0 }]),
    ),
  };
}

/** Checks available descriptions and links; file bytes and recorded acceptance have separate owners. */
export function checkArtifactReferences(
  artifact: Artifact,
  sources: ReadonlyArray<Source>,
  artifacts: ReadonlyArray<Artifact>,
): ReadonlyArray<ArtifactLocalCheck> {
  const metadataValid =
    hasText(artifact.id) &&
    hasText(artifact.title) &&
    TYPES.has(artifact.type) &&
    RELEASES.has(artifact.arc) &&
    Number.isSafeInteger(artifact.pass) &&
    artifact.pass > 0;
  const checks: ArtifactLocalCheck[] = [
    {
      key: "metadata",
      name: "Artifact description",
      result: metadataValid ? "pass" : "fail",
      note: metadataValid
        ? "Title, file type, release and revision are present."
        : "Review the title, file type, release and revision.",
    },
  ];
  const references = new Map(
    [...artifacts, ...sources].map((record) => [record.id, record]),
  );
  if (
    !Array.isArray(artifact.derivedFrom) ||
    artifact.derivedFrom.length === 0
  ) {
    checks.push({
      key: "references",
      name: "Parent references",
      result: "fail",
      note: "Add a source or earlier artifact reference.",
    });
    return checks;
  }
  artifact.derivedFrom.forEach((id, index) => {
    const record = hasText(id) ? references.get(id) : undefined;
    const valid = record && record.id !== artifact.id && hasText(record.title);
    checks.push({
      key: `reference-${index}`,
      name: record?.title || "Unavailable reference",
      result: valid ? "pass" : "fail",
      note: valid
        ? "Linked record is available locally."
        : `Review reference ${hasText(id) ? id : index + 1}: choose a different available source or artifact.`,
    });
  });
  return checks;
}

export function createArtifactCommands(owner: {
  readonly getState: () => ArtifactWorkflows;
  readonly getSources: () => ReadonlyArray<Source>;
  readonly commit: (next: ArtifactWorkflows) => void;
  readonly checkPermission: (
    request: Pick<CommandPermission, "action" | "subjectId">,
  ) => PermissionDecision;
}) {
  return {
    execute(command: ArtifactCommand): CommandResult {
      if (
        !command ||
        !ACTIONS.has(command.type) ||
        typeof command.id !== "string" ||
        !Number.isSafeInteger(command.revision) ||
        command.revision < 0
      ) {
        return commandRefusal(
          "invalid",
          "Choose an available artifact and action.",
        );
      }
      const state = owner.getState();
      const record = Object.prototype.hasOwnProperty.call(
        state.byId,
        command.id,
      )
        ? state.byId[command.id]
        : undefined;
      if (!record)
        return commandRefusal("missing", "This artifact is unavailable.");
      const permission = owner.checkPermission({
        action: command.type === "check" ? "analysis.run" : "workspace.edit",
        subjectId: record.id,
      });
      if (!permission.ok) return identifyRefusal(permission);
      if (record.revision !== command.revision)
        return commandRefusal(
          "transition",
          "This artifact changed. Review its current proposal before continuing.",
          "STALE_REVISION",
        );
      let next: ArtifactRecord;
      switch (command.type) {
        case "check":
          next = {
            ...record,
            localChecks: checkArtifactReferences(
              record,
              owner.getSources(),
              Object.values(state.byId),
            ),
          };
          break;
        case "prepare":
          if (record.proposal)
            return commandRefusal(
              "transition",
              "Edit or discard the existing proposal.",
            );
          next = {
            ...record,
            proposal: {
              parentId: record.id,
              title: `${record.title} — proposed revision`.slice(
                0,
                ARTIFACT_PROPOSAL_LIMITS.title,
              ),
              change:
                "Review deferred work against the recorded acceptance findings.",
            },
          };
          break;
        case "save": {
          if (!record.proposal)
            return commandRefusal(
              "transition",
              "Prepare a revision proposal first.",
            );
          if (
            !hasText(command.title) ||
            !hasText(command.change) ||
            command.title.trim().length > ARTIFACT_PROPOSAL_LIMITS.title ||
            command.change.trim().length > ARTIFACT_PROPOSAL_LIMITS.change
          ) {
            return commandRefusal(
              "invalid",
              "Give the proposal a short title and a planned change.",
            );
          }
          const proposal = {
            ...record.proposal,
            title: command.title.trim(),
            change: command.change.trim(),
          };
          if (
            proposal.title === record.proposal.title &&
            proposal.change === record.proposal.change
          )
            return { ok: true, changed: false };
          next = { ...record, proposal };
          break;
        }
        case "discard":
          if (!record.proposal)
            return commandRefusal(
              "transition",
              "This artifact has no revision proposal to discard.",
            );
          next = { ...record, proposal: undefined };
          break;
      }
      owner.commit({
        ...state,
        byId: {
          ...state.byId,
          [record.id]: { ...next, revision: record.revision + 1 },
        },
      });
      return { ok: true, changed: true };
    },
  };
}
