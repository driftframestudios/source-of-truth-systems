# Run and explore the example

Each clone can run its own PostgreSQL-backed synthetic example. Plate history and expiring Source metadata survive restarts; other workflow edits retain their browser-session lifetime. [Fixture provenance](fixture-provenance.md) explains the supplied findings and policy assumptions.

## Start the complete local application

Source access currently requires a repository invitation. You can explore the [live application](https://kindlight.ai) immediately; the steps below apply once you have the clone.

Install Git, Node **22.15 or newer within 22.x**, and Docker with Compose. From the clone's root:

```sh
node scripts/clone.mjs configure --port 3000
node scripts/clone.mjs up
```

Open `http://localhost:3000`. The build installs locked dependencies, creates this clone's private configuration and isolated database volume, initializes canonical examples, and starts the app after schema validation. Host pnpm is optional for this route. Select another loopback port during configuration if needed.

Open Plate → Sample history and select C3 to see **Stored history**. In Sources, start a saved workspace, edit a title, and reload. A workspace lasts up to 24 hours and belongs to its original browser and origin. Stop/start preserves its database:

```sh
node scripts/clone.mjs stop
node scripts/clone.mjs up
```

[Local clone operations](runbooks/local-postgresql-clone.md) covers readiness, separate Docker contexts, two clones, backups, restore, reset and an existing native PostgreSQL server. [Database choices](database-choices.md) explains the storage decision and extension options.

## Start the local interface

Install Node **22.15 or newer within 22.x** and pnpm **10.34.3**. [package.json](../package.json) and [.mise.toml](../.mise.toml) declare the supported toolchain. From the clone's root:

```sh
pnpm install --frozen-lockfile
npm run dev:source
```

Open `http://localhost:8443`, or the URL printed when you deliberately set another `PORT`. The server uses a strict port; if 8443 is occupied, stop that owned process or run `PORT=8444 npm run dev:source`. Stop this server with Ctrl+C when finished.

`dev:source` runs Vite with hot reload. It uses bundled example records and local Source edits, without installing a database or starting the production GraphQL routes. Reload returns local workflow edits to their example state; appearance and the first-invitation preference have separate browser storage. Use the Node route below to inspect actual API behavior.

## Follow a sample

Open **Guide** in the header and choose a question or **Watch walkthrough**. Watch the three scenes or select a question and explore at your own pace. Taking control or closing the guide leaves the current scene available.

For direct exploration, open Plate and select C3. Compare the results and related files in Sample history. C3's example distinguishes reanalysis of existing reads from a later confirmation; the displayed history supplies the details. On mobile, the Corridor and Plate use compact controls and record panels. Resizing retains the selected scene and sample.

## Run the Node API locally

Leave `DATABASE_PROVIDER` and database-specific `DB_*`/`PG*` settings absent for the bundled example adapter. A partially configured database produces an unavailable stored read, rather than silently selecting examples. Ordinary startup does not automatically read a local `.env` file.

```sh
npm run build
PORT=3000 npm start
```

Open `http://localhost:3000`. The build creates public `dist/` and private `build/server/`; keep both together with the server source. `scripts/serve.mjs` exposes the two GraphQL routes and serves only the intended public directory. The no-database deployment keeps Source edits local. [GraphQL reads](graphql-read-api.md) includes a complete approved-query request; [visitor workspaces](visitor-workspaces.md) describes optional expiring Source persistence.

This Node route also serves [the developer documentation](site/implementation.md) at `http://localhost:3000/docs/`. The app's **Developer docs** link opens it separately while preserving current work. The Vite source-development process above remains the lighter interface-only route.

This is a production-like local process, not a public deployment. Stop it with Ctrl+C. [Deployment](deployment.md) describes hosting, optional database setup and recovery.

## Try a focused check

After dependency installation, run:

```sh
npm run test:mobile
```

This source-owned Node test exercises Corridor pointer ownership, pinch and release behavior. It needs neither a production build nor a browser installation. It establishes gesture behavior, while a layout change still needs a visual/browser observation. [The test guide](../tests/README.md) routes to other owners and the complete build-dependent suite.

## If startup needs attention

| Observation | Next action |
| --- | --- |
| Unsupported Node or package-manager version | Use the declared 22.x/pnpm toolchain, then repeat the frozen install. |
| Frozen install rejects a changed dependency graph | Inspect the root package and lockfile together. An intentional dependency change follows the [maintenance runbook](runbooks/dependency-maintenance.md). |
| `npm start` reports a missing projection | Run `npm run build` in the same clone before starting. |
| Stored history is unavailable | For a clone, inspect `node scripts/clone.mjs status` and `logs`; [PostgreSQL setup](postgresql.md) explains schema recovery. The bundled route needs database configuration absent. |
| Fonts are unavailable offline | System fallbacks remain usable. [Font delivery](../ATTRIBUTIONS.md#fonts) explains the external requests and a deliberate self-hosting route. |

[Documentation](README.md) · [Repository](../README.md)
