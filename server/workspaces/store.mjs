import { randomUUID } from "node:crypto";
import { workspaceTransaction } from "./connection.mjs";
import {
  requireWorkspaceSchema,
  WORKSPACE_TABLES,
  existingWorkspaceTables,
  verifyWorkspaceTables,
} from "./schema.mjs";
import { WORKSPACE_LIMITS } from "./limits.mjs";

const refuse = (kind, reason) => ({ ok: false, kind, reason });
const expired = () =>
  refuse(
    "expired",
    "This visitor workspace has ended. Start a new workspace to save changes.",
  );
const invalid = () =>
  refuse("invalid", "Choose a valid source metadata operation.");
const hex = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const time = (value) =>
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 8_640_000_000_000_000 - WORKSPACE_LIMITS.ttlMs;
const text = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
function validOrigin(value) {
  if (!text(value, 300)) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
const json = (value) => (typeof value === "string" ? JSON.parse(value) : value);
const metadata = (value) =>
  value &&
  text(value.title, 180) &&
  text(value.description, 2000) &&
  Array.isArray(value.tags) &&
  value.tags.length <= 12 &&
  value.tags.every((tag) => text(tag, 40));
const copyMetadata = (value) => ({
  title: value.title,
  description: value.description,
  tags: [...value.tags],
});
const actorValid = (value) =>
  value &&
  ["principalId", "roleId", "environment"].every((key) => text(value[key], 80));
const revisionValid = (value) =>
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= WORKSPACE_LIMITS.changedEvents;
const workspaceView = (row) => ({
  id: row.id,
  createdAt: new Date(Number(row.created_ms)).toISOString(),
  expiresAt: new Date(Number(row.expires_ms)).toISOString(),
  eventCount: row.changed_count,
});
const entryView = (row) => ({
  sourceId: row.source_id,
  record: copyMetadata(json(row.metadata)),
  revision: row.revision,
});
const eventView = (row) => ({
  id: row.event_id,
  sourceId: row.source_id,
  action: row.action,
  actor: json(row.actor),
  createdAt: new Date(Number(row.accepted_ms)).toISOString(),
  expectedRevision: row.expected_revision,
  resultRevision: row.result_revision,
});
const receiptView = (row, workspace, replayed) => ({
  ok: true,
  changed: Boolean(row.changed),
  replayed,
  entry: {
    sourceId: row.source_id,
    record: copyMetadata(json(row.result_metadata)),
    revision: row.result_revision,
  },
  event: row.changed ? eventView(row) : null,
  workspace: workspaceView(workspace),
});

async function findWorkspace(connection, tokenHash, now, origin, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, created_ms, expires_ms, changed_count, receipt_count FROM showcase_visitor_workspaces WHERE token_hash = ? AND origin = ?${lock ? " FOR UPDATE" : ""}`,
    [tokenHash, origin],
  );
  return rows[0] && Number(rows[0].expires_ms) > now ? rows[0] : null;
}

/** Public metadata overrides are isolated by the server-issued token verifier. */
export function createWorkspaceStore(options, { connect } = {}) {
  const run = (write, operation) =>
    workspaceTransaction(
      options,
      async (connection) => {
        await requireWorkspaceSchema(connection);
        return operation(connection);
      },
      { connect, write },
    );

  return Object.freeze({
    async status() {
      try {
        return await workspaceTransaction(
          options,
          async (connection) => {
            const tables = await existingWorkspaceTables(connection);
            if (tables.size === 0) return { available: false, mode: "local" };
            if (tables.size !== WORKSPACE_TABLES.length)
              return { available: false, mode: "unavailable" };
            await requireWorkspaceSchema(connection);
            await verifyWorkspaceTables(connection, tables);
            return { available: true, mode: "stored" };
          },
          { connect },
        );
      } catch {
        return { available: false, mode: "unavailable" };
      }
    },

    async create({ id, tokenHash, now, expiresAt, origin }) {
      if (
        !text(id, 36) ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) ||
        !hex(tokenHash) ||
        !validOrigin(origin) ||
        !time(now) ||
        expiresAt !== now + WORKSPACE_LIMITS.ttlMs
      )
        return invalid();
      return run(true, async (connection) => {
        // One short global admission lock prevents parallel creates exceeding the cap.
        await connection.execute(
          "SELECT singleton FROM showcase_workspace_schema WHERE singleton = 1 FOR UPDATE",
        );
        await connection.execute(
          `DELETE FROM showcase_visitor_workspaces WHERE expires_ms <= ? ORDER BY expires_ms, id LIMIT ${WORKSPACE_LIMITS.cleanupBatch}`,
          [now],
        );
        const [[count]] = await connection.execute(
          "SELECT COUNT(*) AS total FROM showcase_visitor_workspaces",
        );
        if (count.total >= WORKSPACE_LIMITS.workspaces)
          return refuse(
            "quota",
            "Visitor workspaces are full. Try again after an earlier workspace expires.",
          );
        const row = {
          id,
          created_ms: now,
          expires_ms: expiresAt,
          changed_count: 0,
          receipt_count: 0,
        };
        try {
          await connection.execute(
            "INSERT INTO showcase_visitor_workspaces (id, token_hash, origin, created_ms, expires_ms) VALUES (?, ?, ?, ?, ?)",
            [id, tokenHash, origin, now, expiresAt],
          );
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY")
            return refuse(
              "conflict",
              "Choose a new visitor workspace identity.",
            );
          throw error;
        }
        return { ok: true, workspace: workspaceView(row) };
      });
    },

    async get(tokenHash, now, origin) {
      if (!hex(tokenHash) || !time(now) || !validOrigin(origin)) return null;
      return run(false, async (connection) => {
        const row = await findWorkspace(connection, tokenHash, now, origin);
        return row ? workspaceView(row) : null;
      });
    },

    async remove(tokenHash, origin) {
      if (!hex(tokenHash) || !validOrigin(origin)) return { removed: false };
      return run(true, async (connection) => {
        const [rows] = await connection.execute(
          "SELECT id FROM showcase_visitor_workspaces WHERE token_hash = ? AND origin = ? FOR UPDATE",
          [tokenHash, origin],
        );
        if (!rows[0]) return { removed: false };
        await connection.execute(
          "DELETE FROM showcase_visitor_workspaces WHERE id = ?",
          [rows[0].id],
        );
        return { removed: true };
      });
    },

    async readSources(tokenHash, now, origin) {
      if (!hex(tokenHash) || !time(now) || !validOrigin(origin)) return null;
      return run(false, async (connection) => {
        const workspace = await findWorkspace(
          connection,
          tokenHash,
          now,
          origin,
        );
        if (!workspace) return null;
        const [rows] = await connection.execute(
          `SELECT source_id, revision, metadata FROM showcase_workspace_sources WHERE workspace_id = ? ORDER BY source_id LIMIT ${WORKSPACE_LIMITS.changedEvents}`,
          [workspace.id],
        );
        return {
          workspace: workspaceView(workspace),
          entries: rows.map(entryView),
        };
      });
    },

    async mutateSource(tokenHash, input, transition) {
      const {
        idempotencyKey,
        intentFingerprint,
        sourceId,
        now,
        actor,
        command,
        origin,
      } = input ?? {};
      if (
        !hex(tokenHash) ||
        !validOrigin(origin) ||
        !time(now) ||
        !text(sourceId, 160) ||
        typeof idempotencyKey !== "string" ||
        !/^[A-Za-z0-9._:-]{1,80}$/.test(idempotencyKey) ||
        !hex(intentFingerprint) ||
        !actorValid(actor) ||
        !command ||
        !["save", "restore"].includes(command.type) ||
        !revisionValid(command.revision) ||
        (command.type === "save" && !metadata(command.metadata)) ||
        typeof transition !== "function"
      )
        return invalid();
      const payload = {
        type: command.type,
        revision: command.revision,
        ...(command.type === "save"
          ? { metadata: copyMetadata(command.metadata) }
          : {}),
      };
      const acceptedActor = {
        principalId: actor.principalId,
        roleId: actor.roleId,
        environment: actor.environment,
      };
      return run(true, async (connection) => {
        const workspace = await findWorkspace(
          connection,
          tokenHash,
          now,
          origin,
          true,
        );
        if (!workspace) return expired();
        const [receipts] = await connection.execute(
          "SELECT * FROM showcase_workspace_receipts WHERE workspace_id = ? AND idempotency_key = ?",
          [workspace.id, idempotencyKey],
        );
        if (receipts[0]) {
          if (receipts[0].intent_fingerprint !== intentFingerprint)
            return refuse(
              "conflict",
              "This operation key already belongs to a different edit. Start a new edit.",
            );
          return receiptView(receipts[0], workspace, true);
        }
        const [rows] = await connection.execute(
          "SELECT revision, metadata FROM showcase_workspace_sources WHERE workspace_id = ? AND source_id = ? FOR UPDATE",
          [workspace.id, sourceId],
        );
        const current = rows[0]
          ? {
              record: copyMetadata(json(rows[0].metadata)),
              revision: rows[0].revision,
            }
          : null;
        if ((current?.revision ?? 0) !== command.revision)
          return refuse(
            "conflict",
            "This source changed. Reopen it to use the current metadata.",
          );
        const result = transition(current);
        if (!result || typeof result.then === "function")
          throw new Error(
            "Workspace source transition must return a synchronous result.",
          );
        if (result.ok === false) return result;
        if (
          result.ok !== true ||
          typeof result.changed !== "boolean" ||
          !metadata(result.record) ||
          result.revision !== command.revision + Number(result.changed)
        )
          throw new Error(
            "Workspace source transition returned an invalid projection.",
          );
        if (
          workspace.receipt_count >= WORKSPACE_LIMITS.receipts ||
          (result.changed &&
            workspace.changed_count >= WORKSPACE_LIMITS.changedEvents)
        )
          return refuse(
            "quota",
            "This workspace has reached its saved-edit limit. Start a new workspace to continue.",
          );
        const record = copyMetadata(result.record);
        if (result.changed)
          await connection.execute(
            "INSERT INTO showcase_workspace_sources (workspace_id, source_id, revision, metadata) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE revision = ?, metadata = ?",
            [
              workspace.id,
              sourceId,
              result.revision,
              JSON.stringify(record),
              result.revision,
              JSON.stringify(record),
            ],
          );
        const receipt = {
          event_id: randomUUID(),
          source_id: sourceId,
          action: command.type,
          actor: acceptedActor,
          accepted_ms: now,
          expected_revision: command.revision,
          result_revision: result.revision,
          changed: Number(result.changed),
          result_metadata: record,
        };
        await connection.execute(
          `INSERT INTO showcase_workspace_receipts (workspace_id, idempotency_key, intent_fingerprint, event_id, source_id, action, payload_version, command_payload, actor, accepted_ms, expected_revision, result_revision, changed, result_metadata) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workspace.id,
            idempotencyKey,
            intentFingerprint,
            receipt.event_id,
            sourceId,
            command.type,
            JSON.stringify(payload),
            JSON.stringify(acceptedActor),
            now,
            command.revision,
            result.revision,
            receipt.changed,
            JSON.stringify(record),
          ],
        );
        await connection.execute(
          "UPDATE showcase_visitor_workspaces SET changed_count = changed_count + ?, receipt_count = receipt_count + 1 WHERE id = ?",
          [receipt.changed, workspace.id],
        );
        workspace.changed_count += receipt.changed;
        return receiptView(receipt, workspace, false);
      });
    },

    async history(
      tokenHash,
      { sourceId, now, origin, limit = WORKSPACE_LIMITS.history },
    ) {
      if (
        !hex(tokenHash) ||
        !validOrigin(origin) ||
        !time(now) ||
        !text(sourceId, 160) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > WORKSPACE_LIMITS.changedEvents
      )
        return null;
      return run(false, async (connection) => {
        const workspace = await findWorkspace(
          connection,
          tokenHash,
          now,
          origin,
        );
        if (!workspace) return null;
        const [rows] = await connection.execute(
          `SELECT event_id, source_id, action, actor, accepted_ms, expected_revision, result_revision FROM showcase_workspace_receipts WHERE workspace_id = ? AND source_id = ? AND changed = 1 ORDER BY result_revision DESC LIMIT ${limit}`,
          [workspace.id, sourceId],
        );
        return {
          workspace: workspaceView(workspace),
          events: rows.map(eventView),
        };
      });
    },
  });
}
