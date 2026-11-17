import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SOURCE_METADATA_LIMITS } from "../services/sourceSession";
import type { SourceEntry, SourceMetadata } from "../services/sourceSession";
import type { CommandResult } from "../services/command";
import type { SourceDraft } from "../services/sourceEditor";

export function SourceMetadataEditor({
  entry,
  onSave,
  onCancel,
  scopeKey,
  draft,
  onChange,
  onRebase,
  busy = false,
  persistence = "local",
}: {
  entry: SourceEntry;
  onSave: (
    metadata: SourceMetadata,
    revision: number,
  ) => Promise<CommandResult>;
  onCancel: () => void;
  scopeKey: string;
  draft: SourceDraft;
  onChange: (patch: Partial<Pick<SourceDraft, "title" | "description" | "tags" | "error">>) => void;
  onRebase: (namespace: string, revision: number) => void;
  busy?: boolean;
  persistence?: "local" | "workspace";
}) {
  // A deliberately replaced workspace rebases the version while retaining the visitor's draft.
  useEffect(() => {
    onRebase(scopeKey, entry.revision);
  }, [scopeKey, entry.revision, onRebase]);
  const [submitting, setSubmitting] = useState(false);
  const pending = busy || submitting;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitting(true);
    try {
      const result = await onSave(
        {
          title: draft.title,
          description: draft.description,
          tags: draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        draft.revision,
      );
      if (!result.ok) onChange({ error: result.reason });
    } catch {
      onChange({ error: "This edit could not be confirmed. Keep your draft and retry." });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form
      className="sources-view__editor"
      aria-label="Edit source metadata"
      onSubmit={submit}
      aria-busy={pending}
    >
      <fieldset className="sources-view__editor-fields" disabled={pending}>
        <label>
          Display title
          <input
            autoFocus
            required
            maxLength={SOURCE_METADATA_LIMITS.title}
            value={draft.title}
            onChange={(event) =>
              onChange({ title: event.target.value })
            }
          />
        </label>
        <label>
          Summary
          <textarea
            required
            maxLength={SOURCE_METADATA_LIMITS.description}
            rows={3}
            value={draft.description}
            onChange={(event) =>
              onChange({ description: event.target.value })
            }
          />
        </label>
        <label>
          Tags
          <span>
            Separate with commas · up to {SOURCE_METADATA_LIMITS.tags}
          </span>
          <input
            value={draft.tags}
            maxLength={
              SOURCE_METADATA_LIMITS.tags * (SOURCE_METADATA_LIMITS.tag + 2)
            }
            onChange={(event) =>
              onChange({ tags: event.target.value })
            }
          />
        </label>
      </fieldset>
      <p>
        {persistence === "workspace"
          ? "Saved in your visitor workspace."
          : "Saved for this browser session."}{" "}
        Source authority and provenance stay with the bundled record.
      </p>
      {draft.error && <p role="alert">{draft.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          className="sources-view__action"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save metadata"}
        </button>
        <button
          className="sources-view__action"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
