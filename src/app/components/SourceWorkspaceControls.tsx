import { useEffect, useState } from "react";
import type { SourceWorkspaceStatus } from "../services/sourceWorkspace";
import type {
  WorkspaceEvent,
  WorkspaceResponse,
} from "../services/workspaceTransport";

export function SourceWorkspaceControls({
  status,
  onRetry,
  onStart,
  onReset,
}: {
  status: SourceWorkspaceStatus;
  onRetry: () => unknown;
  onStart: () => unknown;
  onReset: () => unknown;
}) {
  return (
    <div className="sources-view__persistence" aria-label="Source workspace">
      <span role="status">
        {status.message}
        {status.phase === "active" && status.workspace && (
          <>
            {" "}
            · expires{" "}
            {new Date(status.workspace.expiresAt).toLocaleDateString()}
          </>
        )}
      </span>
      {(status.phase === "unavailable" || status.phase === "denied") && (
        <button
          className="sources-view__action"
          disabled={status.busy}
          onClick={() => void onRetry()}
        >
          Retry workspace
        </button>
      )}
      {status.phase === "expired" && (
        <button
          className="sources-view__action"
          disabled={status.busy}
          onClick={() => void onStart()}
        >
          Start another workspace
        </button>
      )}
      {status.phase === "active" && (
        <button
          className="sources-view__action"
          disabled={status.busy}
          onClick={() => void onReset()}
        >
          Reset workspace
        </button>
      )}
    </div>
  );
}

export function SourceWorkspaceHistory({
  sourceId,
  status,
  scopeKey,
  read,
}: {
  sourceId: string;
  status: SourceWorkspaceStatus;
  scopeKey: string;
  read: (id: string) => Promise<WorkspaceResponse>;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ReadonlyArray<WorkspaceEvent>>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let current = true;
    setEvents([]);
    if (open && status.phase === "active") {
      setMessage("Loading saved edits…");
      void read(sourceId).then((response) => {
        if (!current) return;
        setEvents(response.events ?? []);
        setMessage(
          response.code === "OK"
            ? response.events?.length
              ? ""
              : "No saved edits for this source yet."
            : response.message,
        );
      });
    }
    return () => {
      current = false;
    };
  }, [
    open,
    sourceId,
    status.phase,
    status.workspace?.id,
    status.workspace?.eventCount,
    scopeKey,
    read,
  ]);
  if (status.phase !== "active") return null;
  return (
    <details
      className="sources-view__history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Saved source edits</summary>
      {message && <p role="status">{message}</p>}
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <span>
              {event.action === "save"
                ? "Metadata saved"
                : "Bundled source restored"}{" "}
              · revision {event.resultRevision}
            </span>
            <time dateTime={event.createdAt}>
              {new Date(event.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
    </details>
  );
}
