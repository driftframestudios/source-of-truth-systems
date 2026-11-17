# Disposable visitor workspaces

Source metadata edits can belong to one expiring browser workspace while the bundled examples remain shared. This implements the owner's disposable-workspace choice. The workspace cookie proves possession of that sandbox. Verified human identity, private records and real multi-user collaboration remain separate design and acceptance boundaries.

## Ownership and data

The first durable workflow is Source **edit metadata / restore bundled source**. Title, summary and tags pass through the same pure domain preparation used by browser commands. Canonical IDs, provenance, source dates, authority and relationships retain their bundled owners. The selected persona supplies a simulated policy scenario; stored event actors are explicitly scenario actors.

`server/workspaces` owns the provider-specific PostgreSQL and retained MySQL schemas, short-lived write connection, workspace lifecycle, finite GraphQL documents and HTTP session boundary. `src/app/services/sourceSession.ts` owns the Source transition and metadata limits. The private server build exports the canonical Source baseline and this preparation function; GraphQL, SQL drivers and token machinery stay outside the browser bundle.

Each workspace lasts 24 hours from creation. Its rows hold metadata overrides, revisions and accepted command receipts. The limits are 128 active workspaces, 64 changed events and 128 total accepted receipts per workspace. No-op receipts count toward the latter limit so their exact retry result can be retained. Bounded expiry cleanup runs on admission; reset deletes the workspace and scoped children. Expiry immediately denies access, while physical cleanup waits for a later admission or operator maintenance. These bounds suit the low-traffic showcase; they are not a promise of anonymous admission under sustained abuse.

## Request boundary

`/workspace/graphql` accepts only registered, named operations through same-origin JSON POST with `x-sot-workspace: 1`. Batching, multipart bodies, arbitrary documents and production exploration are disabled. The body is bounded to 16 KiB and the response deadline is five seconds. All responses, including errors and deadline responses, use `Cache-Control: no-store`.

The server generates a 256-bit opaque token and stores only its SHA-256 verifier. HTTPS uses the `__Host-sot-workspace` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/` and an absolute expiry. HTTP loopback development uses a separately named cookie. Tokens stay out of URLs, browser storage, API result fields and logs. A workspace row is also bound to its normalized owning origin, including the port, so preview and publish remain independent even when their database is shared.

Admission compares the browser Origin with the incoming Host, allowing the hosting proxy to terminate TLS while avoiding forwarded-host authority. A cross-site request, invalid origin, simple content type or missing custom header is rejected before storage opens. Origin checks mitigate browser CSRF; they do not authenticate a person. Deployment-wide database quotas and a process-level creation throttle bound anonymous allocation. A future account implementation replaces this public ownership boundary with verified identity.

## Acceptance and recovery

Save and Restore carry an expected revision and an opaque command identifier. Current simulated policy and metadata validation run before acceptance, including a retry. The store locks the workspace, compares the current version, and commits the projection and receipt together. Reusing the same identifier and normalized intent returns its original accepted result; reusing it for different intent conflicts. Readers must retain the newer revision if an older receipt returns later.

`WorkspaceStatus` distinguishes an intentionally uninstalled feature (`LOCAL`) from unavailable storage. Existing local Source editing remains the ordinary behavior until the additive workspace schema is explicitly installed. A retained workspace cookie or a failed database connection cannot silently turn a hosted write into local success. Typed absence, expiry, denial, conflict, quota and unavailability let the receiving interface retain a draft and offer the next useful action.

Start reuses a still-valid workspace without extending its lifetime. Reset revokes the current scope and clears its cookie; a later Start creates a new scope. An ambiguous network response can follow a committed transaction, so the client retries the same command identifier. A failed initial Start can leave a bounded, inaccessible workspace until expiry; subsequent explicit creation remains subject to the same quotas.

## Deployment and evidence

The [PostgreSQL clone](runbooks/local-postgresql-clone.md) installs the catalog and workspace schemas through its explicit initializer, then starts the ordinary app with a separate runtime role. Native operators follow the same [schema/grant contract](postgresql.md). Ordinary startup performs no DDL. Reset in Sources removes only that visitor workspace; a clone-wide database reset is a distinct, explicitly confirmed operator command.

Verify an accepted Source edit survives reload at the same origin with its workspace cookie. App/database restart retains it within the 24-hour lifetime. A trusted backup restores saved rows and receipts; access still requires the original unexpired cookie and origin. Two clones on different localhost ports use separate browser contexts because cookies share a hostname while workspace authorization binds the exact origin.

Domain tests establish validation, provenance and command-time policy. API and HTTP checks exercise finite operations, cookie-derived scope, denied/stale/repeated commands, typed recovery and uncached responses. PostgreSQL engine checks establish migration ownership, rollback, concurrent revision/idempotency/quota behavior and indexed reads. The [clone proof](runbooks/local-postgresql-clone.md#run-the-owned-clone-proof) exercises actual process restart, backup recovery, failed-restore preservation and clone reset isolation. A receiving remote host retains its own observation.

The [storage contract](workspace-storage.md) describes expiry, admission and immutable receipts; [PostgreSQL setup](postgresql.md) names current configuration and recovery. Private-data accounts and lasting clinical audit records remain separate future work.
