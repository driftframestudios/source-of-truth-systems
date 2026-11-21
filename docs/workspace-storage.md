# Isolated visitor workspace storage

`server/workspaces` owns short-lived PostgreSQL persistence (with a retained MySQL compatibility adapter) for accepted Source metadata. A workspace keeps a visitor's title, summary and tags separate from the public catalog and from other visitors. The HTTP owner issues the opaque browser token; storage receives only its SHA-256 verifier, a random workspace identifier and the normalized owning origin. The actor recorded in an event is the selected showcase principal, role and environment; it represents the scenario used for acceptance.

This storage tranche provides the transaction boundary. The receiving API and client own cookie issuance, current scenario authorization, baseline source records, useful refusal feedback and the visible workspace lifecycle.

## Data and lifetime

`limits.mjs` owns a 24-hour absolute lifetime, 128 retained workspaces, 64 changed events per workspace, and 128 accepted-command receipts per workspace. Accepted no-ops have receipts so a later retry receives the same original outcome; they do not appear in changed-event history. Each new workspace admission removes at most 16 expired workspaces. Expired records stop being readable or editable immediately; physical cleanup occurs on subsequent admissions. Explicit removal deletes the workspace and cascades its projections and receipts in the same transaction.

The owning origin accompanies every lookup, edit, history read and removal. The returned workspace exposes its identifier, creation/expiry times and changed-event count. Token verifiers, origin bindings, command fingerprints and idempotency keys remain inside storage. Source provenance stays in the canonical bundled records; stored overrides contain only bounded metadata and a revision.

| Table | Ownership |
| --- | --- |
| `showcase_workspace_schema` | Separate migration version/signature and serialized workspace admission |
| `showcase_visitor_workspaces` | Token verifier, origin, absolute lifetime and bounded counters |
| `showcase_workspace_sources` | Workspace/source key, accepted metadata and revision |
| `showcase_workspace_receipts` | Scoped retry key, normalized command, simulated actor, server acceptance time, revisions and immutable result |

History is scoped to one source, defaults to 20 changed events and accepts a maximum of 64. Resulting revision orders that history even when two events share a timestamp. This is an inspectable showcase history with workspace expiry, rather than a permanent clinical audit record.

## Transaction contract

The selected adapter opens a short-lived connection per operation. Writes explicitly use **READ COMMITTED** so a request waiting for an ownership lock sees its predecessor's accepted receipt and the latest admission count. Reads use a consistent read-only snapshot. Connections have a two-second connect/lock limit and a four-second operation deadline; the owner closes the transport on timeout. A lost commit response is recovered through the original idempotency key.

Creation locks the singleton migration row before cleanup, count and insertion. Source commands lock the workspace before the source projection. Removal takes the same workspace lock, so it orders against accepted edits. A source transaction:

1. Resolves the token and owning origin, and checks absolute expiry.
2. Returns the original receipt for an identical retry; a changed fingerprint returns a conflict.
3. Compares the expected source revision. Missing overrides represent the canonical baseline at revision zero.
4. Invokes the caller's synchronous, current-policy transition against that locked projection.
5. Applies the projection, accepted event/receipt and counters atomically.

The API checks current authorization before retry lookup and in the transition. Refused transitions leave storage unchanged. The callback returns a bounded metadata projection; arbitrary properties and source provenance never enter the stored result. Same-key replay retains its original accepted record even after later edits.

## Explicit schema ownership

Use the [clone initializer](runbooks/local-postgresql-clone.md), or deliberately run `node --env-file-if-exists=.env scripts/database.mjs workspace-init` with the intended PostgreSQL setup role. Workspace setup is separate from catalog initialization and preserves existing catalog records. Ordinary build/start performs no DDL.

PostgreSQL setup owns one transaction, advisory lock, immutable schema checksum and physical-shape signature. Fresh setup commits all owned tables and its ready marker together. Repeated matching setup retains records. Foreign/partial tables, unsupported versions and changed constraints or indexes require inspection before repair. Future migrations retain released schema identities. [The PostgreSQL contract](postgresql.md) records this transaction and runtime-grant boundary.

The retained MySQL initializer has a separate signature and pending ownership marker because MySQL DDL can commit independently. Its optional proof preserves that compatibility behavior; public clone setup uses PostgreSQL.

`status()` distinguishes three receiving states: `stored` means the matching schema is available; `local` means all four tables are absent; `unavailable` means the connection or installed schema needs attention. An outage or partial migration therefore cannot silently redirect an accepted durable edit into browser-only state.

## Focused evidence

`node --test tests/workspace-storage.test.mjs` covers shared input admission and the retained MySQL connection boundary. [PostgreSQL engine and HTTP checks](postgresql.md#focused-evidence) exercise atomic setup, catalog preservation, current revision/permission checks, concurrent stale writes and quota admission, exact retries, rollback, expiry, removal and indexed reads. The [container proof](runbooks/local-postgresql-clone.md#run-the-owned-clone-proof) adds actual process restart and trusted backup recovery using the original browser workspace.

For a change to MySQL compatibility, `npm run test:mysql` deliberately exercises that adapter on an independently provisioned disposable loopback database. Ordinary unit checks and PostgreSQL proof each retain their own population; one passing adapter is not evidence that the other ran.

## Response admission

`workspaceResponse.ts` decodes each registered GraphQL operation by its expected field. It copies bounded workspace, Source and event records; checks revision/time shapes, unique identities and requested Source ownership; and returns an operation-specific success or acknowledged refusal. Malformed or lost receipts become `UNAVAILABLE`, preserving the command's draft and idempotency identity for retry. `sourceWorkspace.ts` still owns domain validation, generation, revision and current-scope publication. A history refresh retains the last accepted events for the same Source/workspace/scope while reporting an unavailable receipt; another scope starts with its own history.

`shared/workspace-contract.mjs` owns finite wire codes, Source text bounds and history/event bounds shared with the server. Snapshot responses admit at most 256 Sources; extending that catalog beyond the receiver bound requires an explicit contract update. The existing eight-second client deadline, server admission and ordinary Node deployment remain unchanged. Focused fetch-to-decoder tests exercise every registered reply, malformed nested records and a lost save receipt followed by an idempotent retry.
