# Deploy the example

Run the complete local application with the [PostgreSQL clone recipe](runbooks/local-postgresql-clone.md). Its isolated app, database and explicit initializer give each clone its own synthetic records and expiring Source workspaces. [Database choices](database-choices.md) explains the supported persistence boundary; [fixture provenance](fixture-provenance.md) explains the example data.

## Choose a route

| Route | Current capability | Operator responsibility |
| --- | --- | --- |
| Local PostgreSQL containers | Pinned app/database images, private project volume, explicit schema/seed validation and runtime role | Docker/Compose and Node 22 for the clone CLI; follow [local operations](runbooks/local-postgresql-clone.md) |
| Native Node with PostgreSQL | Full static assets, GraphQL and stored histories/Source workspaces | Provision database/roles, run explicit setup, inject runtime settings, manage process and backups |
| Node with database configuration absent | Scoped GraphQL over bundled synthetic records and browser-session edits | Build and start the Node server |
| Local Vite development | Hot reload and bundled interface examples | Install the frozen dependency graph; Vite does not host the Node APIs |
| Static browser assets | Browser presentation without the Node APIs or durable workspaces | Choose that limited scope explicitly, or provide a separately configured API |
| Standalone documentation | `build:foundation` emits admitted articles at the root of `dist-foundation/` | Static publication, domain configuration and a receiving-host check |

## Ordinary Node hosting

Use the declared Node 22.x and pnpm versions. From the reviewed source:

```sh
pnpm install --frozen-lockfile --prod=false
npm run build
PORT=3000 npm start
```

The server binds the process to the host interface on `PORT`. Keep `dist/`, `build/server/`, server/shared source and required runtime packages together. The [Dockerfile](../Dockerfile) installs the full frozen graph for compilation, then prunes development packages before copying the non-root runtime image. Native source-building hosts also install with `--prod=false`, even when their environment sets `NODE_ENV=production`. A host receiving already-built artifacts can install with `pnpm install --frozen-lockfile --prod` or prune its completed build with `pnpm prune --prod`. Publishing `dist/` alone omits `/graphql` and `/workspace/graphql`. `vite preview` is an asset preview rather than the complete application server.

For persistence, follow [PostgreSQL setup](postgresql.md) or the native route in [local operations](runbooks/local-postgresql-clone.md). An ordinary database-owning setup login initializes the catalog and workspace schema. A distinct runtime login receives bounded data privileges. Normal application startup reads existing records; schema changes remain explicit operator work. The complete absence of database settings selects bundled examples. Partial settings and configured storage failures retain their visible failure state.

A remote operator owns HTTPS termination, process lifetime, network restrictions, database TLS and backups. The local clone recipe binds the published app port to loopback. The native Node server listens on its host interface, so use a firewall or reverse proxy for the intended audience. Local serving checks establish HTTP, source-file exclusion, finite GraphQL operations and startup behavior; they leave provider proxy, certificate and backup behavior for that provider's check.

Review [site metadata](../.figma/make/site.json) before publishing a clone. Set the canonical `url` and social image for the intended origin. The build enables indexing and publishes selected documentation at `/docs/`, `/llms.txt` and `/llms-full.txt`; review those sources as public content. After deployment, observe one built asset, the mobile Corridor, Plate C3 and any installed workspace. Record the deployed source revision beside that result.

## Dependency ownership

The package manifest distinguishes packages needed by the running Node process from those needed to produce its artifacts. Versions and peer relationships remain pinned by the lockfile.

| Package family | Receiving stage and source owner |
| --- | --- |
| GraphQL Yoga, persisted operations, GraphQL and the request adapter | Node runtime; `server/graphql/` and `server/workspaces/` |
| `pg` and `mysql2` | Node runtime and explicit setup; PostgreSQL clone initialization/runtime grants plus retained MySQL compatibility |
| `serve-handler` | Node runtime; `scripts/serve.mjs` serves completed files |
| React, Radix, TanStack Table, Motion, Lucide and style utilities | Build preparation; Vite embeds their browser code in `dist/` |
| Vite, its React/Tailwind plugins, Tailwind and animation CSS | Build preparation; application, private example-data and documentation entry points |
| `markdown-it` | Build preparation; `scripts/documentation/render.mjs` emits static articles. The Node documentation route reads those completed files. |
| TypeScript, type packages, Playwright and Prettier | Development and verification |

`devDependencies` therefore includes browser libraries as well as tools: the running Node server consumes their compiled assets. The generated private example-data module has no package imports. A future server-side renderer or runtime Markdown feature must classify its own imports before joining this production closure. Keep required peers with their runtime consumer; for example, GraphQL Yoga retains `graphql`.

For a packaging change, compare paths, modes and bytes in `dist/` and `build/` at fixed application/documentation inputs, then run the [owned clone proof](runbooks/local-postgresql-clone.md#run-the-owned-clone-proof). Report container/dependency size separately from browser payload and interaction performance. The [dependency runbook](runbooks/dependency-maintenance.md) owns ongoing updates and advisory review.

## Source development and Figma Make

`npm run dev` and `npm run dev:source` run Vite with hot reload. The source retains [.figma/make](../.figma/make), [.mise.toml](../.mise.toml) and [the Vite adapter](../vite.figma.config.ts) for asset resolution, metadata and preview configuration. A fresh Make session owns its install/preview/import verification. Its existing static deployment script does not establish a Node GraphQL process. The root package and frozen lockfile remain the dependency owners.

## Recover and continue

Preserve the previous reviewed source or image for application rollback. A source rollback leaves database records intact. The [clone runbook](runbooks/local-postgresql-clone.md) supplies bounded stop/start, trusted backup restore and confirmed reset; another host supplies its own recovery process. Keep credentials, database dumps and browser cookies with their private owners.

Application delivery, schema setup, repository visibility and documentation-site publication are distinct actions. Copied workflows do not copy account settings, secrets, DNS or protection policies. [Automation](development-automation.md) names current checks; a successful test supplies evidence for its selected behavior and does not publish the application.

[Documentation](README.md) · [Repository](../README.md)
