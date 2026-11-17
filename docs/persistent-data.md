# Stored Plate records

The public edition persists synthetic Plate history through PostgreSQL and serves the same canonical records through GraphQL. Use the [isolated clone](runbooks/local-postgresql-clone.md) for a complete setup, or [PostgreSQL configuration](postgresql.md) for an existing owned database. Bundled examples remain available when database settings are absent. The retained MySQL adapter is an optional compatibility implementation behind the same repository boundary.

## Record ownership

The catalog owns a version and fixed observation date. Wells have plate-local coordinates. Results have opaque global IDs, a well anchor and an ordered sequence. Physical files have one object-key identity; each result owns its artifact reference, legal hold, reuse lineage and initial restore state. Relational columns, foreign keys and indexes carry those relationships. Bounded JSON carries leaf details such as metrics.

[Canonical seed preparation](../server/data/prepare-catalog-seed.mjs) validates the supplied synthetic catalog before either SQL adapter installs it. PostgreSQL owns [its schema](../server/data/postgres-schema.sql), immutable checksum, transaction and physical-shape signature. MySQL retains its separate [schema](../server/data/schema.sql) and ownership marker. An installed catalog remains authoritative when a later bundled seed differs; changing a fixture performs no automatic data replacement.

[Shared record decoding](../shared/plate-records.mjs) returns fresh canonical values and checks text, supported Unicode, enums, dates, null meaning, numbers and file identity. The server validates before publishing a stored read. The browser validates a complete history before replacing its selected record projection. Successful empty history stays empty, and a missing well stays missing.

## Read and connection ownership

One GraphQL operation owns one lazy, short-lived connection and read-only snapshot. Corridor-only requests open no database connection. Query parameters remain bound values. Histories retrieve artifacts in a batch and cache results inside that request, preserving a consistent operation without querying each artifact separately. Cleanup owns transaction completion and transport release; cancellation settles the underlying driver work. [PostgreSQL](postgresql.md) describes isolation, bounded retries and ordinary-role privileges.

A configured outage, missing schema or invalid stored record retains the stored-data failure. The browser can show explicit Retry or example-history controls without silently replacing accepted storage. Source metadata has its separately scoped write contract in [visitor workspaces](visitor-workspaces.md); ordinary Plate catalog reads do not mutate results or files.

## Browser receiving scope

The selected well's history is the first stored receiver on desktop and mobile. Its source strip identifies stored records, examples, loading or recovery. Successful histories are cached by current permission scope; failed reads remain retryable. Corridor and overview projections retain their bundled owners, so the source label names selected history rather than claiming whole-application durability.

Physical-file recovery overlays remain browser-session actions. Reload begins a new example session for those actions. Opaque result IDs carry no navigation encoding. The catalog observation date must agree with the showcase lifecycle clock before the client accepts stored history.

## Setup, recovery and evidence

Use [local operations](runbooks/local-postgresql-clone.md) for initial setup, app/database restart, trusted backup restore and confirmed project reset. Ordinary build/start performs no DDL. Repeated explicit initialization validates owned schema and retains accepted records; drift, foreign tables or incomplete ownership receive a recovery error for inspection. Application rollback preserves database contents.

The ordinary suite checks example reads, DTO agreement, invalid/empty/missing states, request disposal and production serving. [PostgreSQL proof populations](postgresql.md#focused-evidence) exercise actual initialization, constraints, relationships, snapshots, rollback and runtime-role HTTP behavior against independently owned disposable databases. The container proof adds app/database restart, original-workspace backup recovery and two-clone isolation. A new host still needs its own receiving observation.

Maintainers changing the retained MySQL adapter can select `npm run test:mysql` with a fresh build, MySQL CLI and a disposable loopback database named `sot_*_test` or `sot_*_proof`. [The proof runner](../scripts/prove-database.mjs) owns opt-ins, destructive ordering and final initialization; it preserves catalog import, store and HTTP coverage without adding a public hosting path. Keep shared or remote production databases outside these checks.

Future result writes, private identities and external assay retrieval need their own authorization, mutation, audit and operational contracts. Current file records describe locations and checksums; they do not upload assay binaries.

[Server](../server/README.md) · [Documentation](README.md)
