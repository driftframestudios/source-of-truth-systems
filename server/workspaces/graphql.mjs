import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSchema, createYoga } from "graphql-yoga";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";
import { useRequestDeadline } from "@whatwg-node/server";
import {
  deriveScenario,
  decidePermission,
} from "../../shared/permission-scope.mjs";
import { createWorkspaceOperationRegistry } from "./operations.mjs";
import { createRequestAdmission } from "../security/request-admission.mjs";

const API_LIMITS = Object.freeze({
  bodyBytes: 16_384,
  deadlineMs: 5_000,
  history: 20,
});
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFUSALS = Object.freeze({
  invalid: "INVALID",
  missing: "MISSING",
  conflict: "CONFLICT",
  transition: "CONFLICT",
  expired: "EXPIRED",
  quota: "QUOTA",
  unavailable: "UNAVAILABLE",
});
const result = (code, message, fields = {}) => ({
  code,
  message,
  available: code !== "UNAVAILABLE" && code !== "LOCAL",
  workspace: null,
  source: null,
  sources: [],
  events: [],
  changed: false,
  replayed: false,
  ...fields,
});
const refuse = (value) =>
  result(REFUSALS[value.kind] ?? "DENIED", value.reason);
const absent = (tokenHash) =>
  result(
    tokenHash ? "EXPIRED" : "ABSENT",
    tokenHash
      ? "This visitor workspace expired. Start another to save example edits."
      : "Start a visitor workspace to keep source edits between visits.",
  );
const metadata = (record) => ({
  title: record.title,
  description: record.description,
  tags: record.tags,
});

/** Cookie authority is supplied by the HTTP session owner, never by GraphQL input. */
export function createWorkspaceApi({
  data,
  prepareSourceCommand,
  sessionPlugin,
  requestAdmission = createRequestAdmission(),
  onError = () => {},
}) {
  const baseline = new Map(data.sources.map((source) => [source.id, source]));
  const stateFor = (id, entry) => ({ order: [id], byId: { [id]: entry } });
  const sourceView = (id, entry) => ({
    id,
    revision: entry.revision,
    ...metadata(entry.record),
  });
  const prepare = (command, entry, checkPermission) =>
    prepareSourceCommand(
      {
        baseline,
        state: stateFor(command.id, entry),
        checkPermission,
      },
      command,
    );
  const permission = (context, action, subjectId) => {
    const parsed = context.scopeResult;
    if (!parsed.ok)
      return { ok: false, kind: "invalid", reason: parsed.reason };
    const scope = parsed.scope;
    return decidePermission(
      {
        principalId: scope.selection.principalId,
        role: scope.selection.roleId,
        environment: scope.selection.environment,
        action,
        subjectId,
      },
      scope.catalog,
    );
  };
  function ownedEntry(id, override) {
    const original = baseline.get(id);
    if (!original) return null;
    if (!override) return { record: original, revision: 0 };
    if (!Number.isSafeInteger(override.revision) || override.revision < 0)
      throw new Error("Invalid stored source revision.");
    // Stored metadata is validated again before joining canonical provenance.
    const checked = prepare(
      { type: "edit", id, revision: 0, metadata: override.record },
      { record: original, revision: 0 },
      () => ({ ok: true }),
    );
    if (!checked.ok) throw new Error("Invalid stored source metadata.");
    return {
      record: checked.next.byId[id].record,
      revision: override.revision,
    };
  }
  async function run(context, operation) {
    try {
      const session = context.visitorWorkspace;
      const availability = session?.store
        ? await session.store.status()
        : { available: false };
      if (
        !availability.available &&
        availability.mode === "local" &&
        !session.tokenHash
      )
        return result("LOCAL", "Source edits stay in this browser session.");
      if (!availability.available)
        return result(
          "UNAVAILABLE",
          "Visitor workspaces are currently unavailable. Your draft remains in this browser.",
        );
      return await operation(session);
    } catch (error) {
      onError(error);
      return result(
        "UNAVAILABLE",
        "Visitor workspaces are currently unavailable. Keep your draft and retry.",
      );
    }
  }
  const readCheck = (context) => {
    const decision = permission(context, "resource.read");
    return decision.ok ? null : refuse(decision);
  };
  async function status(context) {
    return run(context, async (session) => {
      if (!session.tokenHash) return absent(null);
      const workspace = await session.store.get(
        session.tokenHash,
        session.now,
        session.origin,
      );
      return workspace
        ? result("OK", "Visitor workspace is available.", { workspace })
        : absent(session.tokenHash);
    });
  }
  async function snapshot(context, sourceId) {
    const denied = readCheck(context);
    if (denied) return denied;
    if (sourceId !== undefined && !baseline.has(sourceId))
      return result("MISSING", "This source is unavailable.");
    return run(context, async (session) => {
      if (!session.tokenHash) return absent(null);
      const saved = await session.store.readSources(
        session.tokenHash,
        session.now,
        session.origin,
      );
      if (!saved) return absent(session.tokenHash);
      const entries = new Map(
        saved.entries.map((entry) => [entry.sourceId, entry]),
      );
      if (sourceId !== undefined)
        return result("OK", "Source loaded.", {
          workspace: saved.workspace,
          source: sourceView(
            sourceId,
            ownedEntry(sourceId, entries.get(sourceId)),
          ),
        });
      return result("OK", "Workspace sources loaded.", {
        workspace: saved.workspace,
        sources: data.sources.map((source) =>
          sourceView(source.id, ownedEntry(source.id, entries.get(source.id))),
        ),
      });
    });
  }
  async function command(context, type, input) {
    if (!UUID.test(input.idempotencyKey))
      return result(
        "INVALID",
        "Use a fresh command identifier to save this edit.",
      );
    const original = baseline.get(input.id);
    if (!original) return result("MISSING", "This source is unavailable.");
    const checkPermission = (request) =>
      permission(context, request.action, request.subjectId);
    const requested = {
      type,
      id: input.id,
      revision: input.expectedRevision,
      ...(type === "edit" ? { metadata: input.metadata } : {}),
    };
    // This first preparation validates and normalizes intent. The transaction
    // prepares it again against its locked current record before acceptance.
    const checked = prepare(
      requested,
      { record: original, revision: input.expectedRevision },
      checkPermission,
    );
    if (!checked.ok) return refuse(checked);
    const normalized = {
      type: type === "edit" ? "save" : "restore",
      revision: input.expectedRevision,
      ...(type === "edit"
        ? { metadata: metadata(checked.next.byId[input.id].record) }
        : {}),
    };
    const scope = context.scopeResult.scope;
    const intentFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          version: 1,
          sourceId: input.id,
          command: normalized,
          policy: scope.key,
        }),
      )
      .digest("hex");
    return run(context, async (session) => {
      if (!session.tokenHash) return absent(null);
      const accepted = await session.store.mutateSource(
        session.tokenHash,
        {
          idempotencyKey: input.idempotencyKey.toLowerCase(),
          intentFingerprint,
          sourceId: input.id,
          now: session.now,
          origin: session.origin,
          actor: { ...scope.selection },
          command: normalized,
        },
        (override) => {
          const current = ownedEntry(input.id, override);
          const prepared = prepare(requested, current, checkPermission);
          if (!prepared.ok) return prepared;
          const entry = prepared.next.byId[input.id];
          return {
            ok: true,
            changed: prepared.changed,
            record: metadata(entry.record),
            revision: entry.revision,
          };
        },
      );
      if (!accepted.ok) return refuse(accepted);
      return result(
        "OK",
        accepted.replayed
          ? "This edit was already accepted."
          : accepted.changed
            ? type === "edit"
              ? "Source changes saved to this workspace."
              : "Bundled source restored in this workspace."
            : "This source already matches the requested version.",
        {
          workspace: accepted.workspace,
          source: sourceView(input.id, ownedEntry(input.id, accepted.entry)),
          changed: accepted.changed,
          replayed: accepted.replayed,
        },
      );
    });
  }
  const schema = createSchema({
    typeDefs: readFileSync(
      new URL("./schema.graphql", import.meta.url),
      "utf8",
    ),
    resolvers: {
      Query: {
        workspaceStatus: (_, args, context) => status(context),
        workspaceSnapshot: (_, args, context) => snapshot(context),
        workspaceSource: (_, { id }, context) => snapshot(context, id),
        workspaceHistory: async (_, { sourceId, limit }, context) => {
          const denied = readCheck(context);
          if (denied) return denied;
          if (!baseline.has(sourceId))
            return result("MISSING", "This source is unavailable.");
          if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > API_LIMITS.history
          )
            return result(
              "INVALID",
              `Choose between 1 and ${API_LIMITS.history} history entries.`,
            );
          return run(context, async (session) => {
            if (!session.tokenHash) return absent(null);
            const saved = await session.store.history(session.tokenHash, {
              sourceId,
              now: session.now,
              origin: session.origin,
              limit,
            });
            return saved
              ? result("OK", "Source history loaded.", saved)
              : absent(session.tokenHash);
          });
        },
      },
      Mutation: {
        startWorkspace: (_, args, context) =>
          run(context, async (session) => {
            const current =
              session.tokenHash &&
              (await session.store.get(
                session.tokenHash,
                session.now,
                session.origin,
              ));
            if (current)
              return result("OK", "Visitor workspace is already available.", {
                workspace: current,
              });
            const started = await session.issueSession();
            return started.ok
              ? result("OK", "Visitor workspace started.", {
                  workspace: started.workspace,
                })
              : refuse(started);
          }),
        resetWorkspace: (_, args, context) =>
          run(context, async (session) => {
            await session.revokeSession();
            return result(
              "ABSENT",
              "Visitor workspace reset. Start another to save new source edits.",
            );
          }),
        saveSource: (_, { input }, context) => command(context, "edit", input),
        restoreSource: (_, { input }, context) =>
          command(context, "restore", input),
      },
    },
  });
  const registry = createWorkspaceOperationRegistry(schema);
  const yoga = createYoga({
    schema,
    logging: false,
    graphqlEndpoint: "/workspace/graphql",
    graphiql: false,
    landingPage: false,
    cors: false,
    batching: false,
    multipart: false,
    maxRequestBodySize: API_LIMITS.bodyBytes,
    maskedErrors: { isDev: false },
    context: ({ params }) => ({
      scopeResult: deriveScenario(
        data.permissionCatalog,
        params.extensions?.scenario,
      ),
    }),
    plugins: [
      sessionPlugin,
      requestAdmission,
      useRequestDeadline({
        timeout: API_LIMITS.deadlineMs,
        response: () =>
          Response.json(
            {
              errors: [
                {
                  message:
                    "Workspace request timed out. Keep your draft and retry.",
                  extensions: { code: "REQUEST_TIMEOUT" },
                },
              ],
            },
            { status: 504, headers: { "Cache-Control": "no-store" } },
          ),
      }),
      usePersistedOperations({
        getPersistedOperation: (hash) => registry.get(hash),
        allowArbitraryOperations: false,
      }),
    ].filter(Boolean),
  });
  return { yoga, operations: registry.operations };
}
