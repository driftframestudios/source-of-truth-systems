# Server, GraphQL and data

[scripts/serve.mjs](../scripts/serve.mjs) serves the browser build and two separately bounded GraphQL APIs. The server build in `build/server/` supplies the same synthetic baseline as the browser while keeping GraphQL, database drivers and session machinery outside `dist/`.

| Boundary | Source | Reader route |
| --- | --- | --- |
| Scoped Corridor/Plate reads | [graphql/schema.graphql](graphql/schema.graphql), [approved operations](graphql/operations/), [api.mjs](graphql/api.mjs) | [Read API](../docs/graphql-read-api.md) |
| Example, MySQL or PostgreSQL catalog | [data](data/), [provider selection](data/provider.mjs) | [Stored catalog](../docs/persistent-data.md), [PostgreSQL](../docs/postgresql.md) |
| Disposable Source metadata writes | [workspaces](workspaces/), [workspace schema](workspaces/schema.graphql) | [Visitor workspaces](../docs/visitor-workspaces.md), [storage](../docs/workspace-storage.md) |
| Bounded document and request admission | [security](security/) | [Input assessment](../docs/research/input-boundaries.md) |
| Browser/server record and policy meaning | [shared](../shared/README.md) | [Permission scenarios](../docs/permission-scenarios.md) |

Use the [complete local clone](../docs/runbooks/local-postgresql-clone.md) for an isolated Node/PostgreSQL setup. For a native server, run `npm run build`, then `PORT=3000 npm start` from the repository root. Leave database configuration absent for the explicit example adapter. Complete `DB_*` settings select MySQL; `DATABASE_PROVIDER=postgres` with complete `PG*` settings selects PostgreSQL; outages and partial configuration remain visible rather than silently downgrading to examples. [Getting started](../docs/getting-started.md#run-the-node-api-locally) and [deployment](../docs/deployment.md) cover the surrounding route.

Production accepts finite registered documents. A new read belongs in the schema and approved-operation inventory, with bounds on its variables and relationships. Both direct and nested lookup paths apply canonical scope. Browser scenario selection models permissions; it does not verify a person's identity. The optional visitor workspace uses the server cookie as its sandbox authority and permits only the defined Source commands, with revision checks and exact retries.

Ordinary server startup performs no schema creation. Catalog and workspace setup are explicit operators with separate ownership markers and recovery rules. Keep database parameters in hosting secrets or an ignored local environment file, and inspect source/build artifacts before delivery. Each operation owns connection cleanup, including after a deadline returns.

After building, `npm run test:graphql` exercises the real local read API. Workspace API/session tests cover their separate boundary; actual MySQL proof uses the guarded [database runner](../docs/development-automation.md), and [PostgreSQL](../docs/postgresql.md#focused-evidence) has separate opt-in populations. [Tests](../tests/README.md) explains these evidence scopes. A new host still needs a receiving deployment observation.

[Documentation](../docs/README.md) · [Repository](../README.md)
