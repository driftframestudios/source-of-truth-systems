# Run and recover a local PostgreSQL clone

This route gives one checkout its own PostgreSQL volume and Node application. It stores the canonical synthetic Plate catalog and expiring Source metadata edits. Other workflow edits retain their current browser-session lifetime. The database serves examples for exploration; clinical operation and identity verification remain separate adaptations.

## Start one clone

Install Docker with Compose v2 or newer, Git, and Node 22.15+ within 22.x. Docker Desktop, a separately owned Colima context, or another compatible Linux engine can supply the daemon. The image build installs the repository’s pinned pnpm and frozen dependencies; host pnpm is useful for source development but unnecessary for these commands.

```sh
node scripts/clone.mjs configure --port 3000
node scripts/clone.mjs up
```

Open `http://localhost:3000`. Configuration creates a random Compose project identity, independent owner/runtime passwords and a checksum tying `.env.clone` to this checkout’s real path. The file is private and ignored. Keep it with the volume; copying a checkout to a new location calls for a new configuration. Two directories with the same basename receive different projects and volumes. Select another port during configuration when another clone is already running.

The PostgreSQL service has no published host port. The app publishes only `127.0.0.1:<chosen-port>`. The database image bootstraps ordinary `sot_owner` and `sot_runtime` roles once for a fresh volume. Compose then waits for database health and a successful one-shot initializer before starting the app. That initializer uses the accepted catalog/workspace migration owners and grants the runtime only catalog reads and required workspace operations. Ordinary app startup preserves stored rows.

`compose.yml` and `Dockerfile` own exact image digests: PostgreSQL 18.7 and Node 22.23.5 for supported Linux architectures. The local acceptance observation names its tested architecture; other receiving platforms earn their own execution check. Update image versions/digests through a focused dependency change, then exercise fresh setup and recovery before adopting them. A database major-version upgrade needs its own explicit migration/restore plan.

To choose an existing Docker context without changing the global default:

```sh
SOT_DOCKER_CONTEXT=your-context node scripts/clone.mjs up
```

This is an optional context name, not a prerequisite to create a VM. The recipe sends build context and keeps database data in a Docker volume; it uses no host-source bind mounts.

## Observe real persistence

Open Plate → Sample history and select C3. The history source should show **Stored history**. In Sources, start a saved workspace and change a title. Reload, then stop/start this clone and verify the accepted title remains:

```sh
node scripts/clone.mjs stop
node scripts/clone.mjs up
```

Stop preserves the volume and local configuration. Source workspace access remains tied to the original browser cookie, exact origin including port, and 24-hour expiry. A new browser or changed port is a different receiving context; restoring database rows does not issue a new workspace credential. The canonical Plate catalog remains available without an active Source workspace. Browser cookies are scoped to the host, while the workspace also checks the exact origin. Use separate browser profiles or isolated contexts when exploring two clones on different localhost ports at the same time, so their cookies stay separate.

## Inspect and recover

```sh
node scripts/clone.mjs status
node scripts/clone.mjs logs
```

Status names this clone’s containers. Logs show a bounded app/initializer tail. If initialization refuses an unowned, partial, newer or drifted schema, keep the volume and inspect the accepted migration contract before retrying. Repeating `up` runs compatibility checks and retains complete records. A failed startup is an observable failure, not a request to silently substitute bundled data.

Database health establishes a reachable server. Initializer success establishes accepted schema/seed compatibility. The app’s HTTP healthcheck establishes an answering page; the Stored-history and accepted-edit observations above establish useful storage behavior.

## Back up and restore this clone

```sh
node scripts/clone.mjs backup
```

Backup writes a private custom-format PostgreSQL dump under `.clone/backups/`. Dumps can contain workspace verifiers and accepted metadata; keep them local or in access-controlled storage. The recipe excludes them, local environments and caches from image build context. It records table data without role credentials, ownership reassignment or grants.

Restore only a trusted backup from this application/schema version. The command first stops the app, restores in one database transaction, reruns schema validation/runtime grants, then starts the app. It replaces this clone’s stored rows. Use the exact project name reported by configure/status as confirmation:

```sh
node scripts/clone.mjs restore .clone/backups/<named-backup>.dump --confirm <this-clone-project>
```

A failed restore or compatibility check keeps the app stopped and the private backup available. Fix the reported local condition before restarting. Retained Source access requires the original cookie/origin within its original expiry; an expired workspace correctly remains expired after restoration. App rollback and database restoration are distinct actions: use an application revision compatible with the stored schema.

## Reset one clone deliberately

First save a backup if its edits matter. This command removes only the explicitly confirmed project’s containers and volume; it retains configuration and backups:

```sh
node scripts/clone.mjs reset --confirm <this-clone-project>
node scripts/clone.mjs up
```

The next startup creates fresh examples. Another clone’s project/volume is outside this operation. Old browser workspace credentials will no longer resolve; start a new Source workspace through its ordinary control.

## Use an existing native PostgreSQL server

The same application can use an operator-owned PostgreSQL 18 database. Provision a dedicated database, an ordinary schema-owning login, and a separate runtime login first. The runtime needs database CONNECT and public-schema USAGE; give the setup role CREATE in its owned public schema. Keep cluster superuser credentials outside the application. Choose distinct database and role names when multiple clones share one server.

Install locked dependencies and run `npm run build`. In a private ignored environment file, set `DATABASE_PROVIDER=postgres`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` (setup owner), `PGPASSWORD`, and `SOT_RUNTIME_ROLE` (the already provisioned runtime login). For a controlled loopback server set `PGSSLMODE=disable`; remote adapters use verified TLS and their own deployment review.

```sh
node --env-file=.env.local-postgres scripts/clone/initialize.mjs
```

The initializer invokes the same canonical migration/seed owners and grants only the required table privileges to the named runtime. Then use a separate private environment file carrying the runtime login/password to serve:

```sh
node --env-file=.env.local-runtime scripts/serve.mjs
```

`PORT` chooses the app port. The ordinary Node server binds all interfaces, so use the host’s local firewall or an appropriately restricted listener/reverse proxy for a private native installation. The Compose route above supplies the loopback publishing boundary directly. Native `pg_dump`/`pg_restore`, service restart and database-role administration belong to that operator; the clone CLI intentionally targets only its own Compose project.

## Run the owned clone proof

`node --test tests/clone.test.mjs` checks configuration identity, privacy, command selection and the runtime-role preflight without Docker. The optional integrated proof creates two temporary same-named checkouts and random Compose projects in an explicitly selected context:

```sh
CLONE_COMPOSE_TEST=1 SOT_DOCKER_CONTEXT=your-context node --test tests/clone-compose.mjs
```

It copies the current Git-tracked and nonignored working source, applies the receiving overlay to the second copy when that manifest is present, and observes Stored history, independent Source edits, container restart, failed and successful backup restoration, reset isolation and offline recovery. It owns loopback ports 33305 and 33306 by default; `CLONE_APP_PORT` and `CLONE_PEER_PORT` select alternatives. Each project's containers and data volume are removed afterward. A failure retains private local configuration/logs for its recovery receiver; it selects no unrelated projects. This API proof retains distinct synthetic cookies per origin. A browser projection check remains a separate observation.

## Source and evidence

[Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) distinguishes health from successful one-shot initialization. The [official PostgreSQL image](https://hub.docker.com/_/postgres) documents fresh-volume init behavior and PostgreSQL 18’s volume layout. [Database choices](../database-choices.md), [visitor workspaces](../visitor-workspaces.md) and [server owners](../../server/README.md) explain the surrounding boundaries.

This runbook accompanies a clone recipe. Record the actual fresh/restart/restore/two-clone observations with the receiving PR; its commands alone establish no hosted deployment or clinical suitability.

## Select the CI receiver

The manual [PostgreSQL clone proof](../../.github/workflows/postgresql-proof.yml) runs the same `tests/clone-compose.mjs` journey on the runner-owned Docker context. Select the reviewed branch or tag and leave `run_checks=true`; clearing it skips the job before runner allocation. The test creates two temporary projects and cleans up only those identities. Credentials, backups, cookies and diagnostic logs stay on the ephemeral runner. The workflow publishes no application or database artifact. A successful run establishes its local container/recovery behavior; a remote deployment retains its own receiving check.
