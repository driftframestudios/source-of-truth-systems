# PostgreSQL catalog and visitor workspaces

The application supports PostgreSQL 18 with `pg` 8.23.1. It persists the canonical Plate catalog/history and expiring Source metadata workspaces through the existing GraphQL APIs. Other workflow edits retain their browser-session lifetime. The public edition supports PostgreSQL and bundled examples. The retained MySQL adapter remains an optional compatibility implementation.

## Configure and initialize an owned database

Use a database created for this application. Keep configuration in an ignored `.env` file or server secrets. Supply `DATABASE_PROVIDER=postgres`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` and `PGPASSWORD`. The default TLS mode is `verify-full`, with certificate verification; `PGSSLROOTCERT` may identify a trusted CA file. Use `PGSSLMODE=disable` only for an explicitly controlled local/Compose network. Credentials remain server-only. The configuration owner rejects mixed MySQL/PostgreSQL settings and incomplete selections.

Build with `npm run build`. With an ordinary database-owning setup role selected, run:

```sh
npm run database:init
node --env-file-if-exists=.env scripts/database.mjs workspace-init
```

Each command owns one transaction, a bounded application advisory lock, its immutable schema checksum and its completion marker. Catalog seed revision/digest are separate from schema identity. First setup creates and seeds the owned relations atomically. Repeated setup validates the installed shape and retains accepted records. Ordinary app startup opens existing records; explicit setup owns DDL.

After setup, select a separate runtime login. Grant it `USAGE` on `public`, `SELECT` on the catalog's six `showcase_*` relations, `SELECT` and `UPDATE (singleton)` on `showcase_workspace_schema`, and `SELECT, INSERT, UPDATE, DELETE` on `showcase_visitor_workspaces`, `showcase_workspace_sources` and `showcase_workspace_receipts`. The marker update privilege permits the admission lock. Keep schema creation/alteration with the setup owner. The [clone initializer](../scripts/clone/initialize.mjs) automates these exact grants; a managed host supplies its own administrative route.

Run the Node server with the selected runtime settings:

```sh
node --env-file-if-exists=.env scripts/serve.mjs
```

The [local clone runbook](runbooks/local-postgresql-clone.md) supplies the complete container recipe, clone identity and backup/restore route. It uses these same native migration and seed owners.

## Record and transaction contracts

Opaque identifiers use case-sensitive `C` collation. Composite foreign keys preserve Plate/well ownership, earlier supersession and reused-file identity. Identity, order, revisions and expiry occupy relational columns. Bounded `jsonb` contains leaf metadata; shared decoders retain domain dates, null meaning, safe integers and supported Unicode.

Source inputs containing NUL or an unpaired surrogate receive `INVALID` before SQL, preserving the editor draft. Logical limits measure the shared compact UTF-8 JSON representation. SQL imposes a separate defensive ceiling on PostgreSQL's rendered JSON text; internal `jsonb` storage bytes do not define command admission or identity. Exact retry fingerprints use the normalized command serializer, independent of JSON key order in storage.

Catalog reads use one request-owned repeatable-read snapshot and batched artifact retrieval. Workspace reads use repeatable read; writes use read committed with workspace locks so waiting commands see the preceding accepted receipt/revision. Admission locks serialize quota checks. Short-lived clients own acquisition, query, rollback/commit and transport cleanup within a finite deadline. Serialization failures and deadlocks receive at most one whole-transaction retry within that deadline. An uncertain commit returns to the original idempotency key; its receipt resolves the accepted result.

The same permission scope, approved GraphQL operations, masked errors, cookie authority and request admission govern each adapter. A configured unavailable store reports its actual state. Database selection never silently replaces accepted stored data with example data.

## Recovery and changes

A fresh setup failure rolls back its DDL, rows and completion marker. Correct the cause and retry the explicit initializer. Partial unmarked tables, newer schema versions, checksum differences and changed columns/constraints/indexes/triggers/RLS stop setup with a recovery error. Keep the existing database and inspect its owner and version before choosing a repair. Apply future changes through a versioned forward migration; preserve released schema checksums.

A complete catalog remains authoritative when a later supplied example seed differs. Changing examples alone performs no live-data replacement. Create a separately owned disposable database to inspect a new seed; a reviewed migration governs changes to an existing one.

A workspace lasts 24 hours and also requires its original cookie verifier and exact origin, including port. Preserving database rows alone grants no new browser access. The clone backup/restore proof uses a controlled origin within that lifetime, and its reset targets only the explicitly confirmed clone.

## Focused evidence

Build first. On an invocation-owned loopback database whose name matches `sot_*_test` or `sot_*_proof`, select `POSTGRES_TEST=1` and run the SQL populations separately:

```sh
node --env-file=.env --test tests/postgres-catalog.mjs
node --env-file=.env --test tests/postgres-workspaces.mjs
node --env-file=.env --test tests/postgres-http.mjs
```

These opt-in checks create and remove their named test relations. Use isolated proof databases, ordinary setup credentials and separate `PGRUNTIMEUSER`/`PGRUNTIMEPASSWORD` where the fixture supports them. Keep hosted/shared databases outside this route.

PostgreSQL 18.6 observations cover atomic and competing initialization, ordinary-role constraints, retained records, bounded/batched relationships, consistent snapshots, schema drift, exact retries, concurrent stale writes, quotas, expiry and reset isolation. Query-plan observations record returned rows/loops on the synthetic fixture; a tiny dataset can reasonably use a sequential scan. HTTP and restart checks distinguish actual process recovery from creating another client. The PostgreSQL 18.7 container recipe also has a separate app/database restart and backup/restore observation.

The Node driver remains outside browser bundles. Existing example/MySQL contracts, production build and startup budget remain receiving checks for source changes.

[Driver transaction ownership](https://node-postgres.com/features/transactions), [client deadlines](https://node-postgres.com/apis/client), [verified TLS configuration](https://node-postgres.com/features/ssl), and [PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html) ground these choices.

[Database choices](database-choices.md) · [Server](../server/README.md) · [Documentation](README.md)
