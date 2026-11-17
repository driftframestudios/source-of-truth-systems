# Corridor and Plate read API

The existing Node server now serves `/graphql` alongside the showcase. It reads the synthetic baseline or the configured Hosted MySQL catalog through a validated, request-local permission scenario. Browser edits retain their current state owner. Finite scenario selection demonstrates policy; verified private identity remains a separate boundary. The [Hosted Database guide](persistent-data.md) owns configuration, initialization, import and recovery.

## Run a read

Use Node 22.15 or newer within the 22.x line, install the pinned dependencies, then:

```sh
npm run build
npm run graphql:operations
PORT=3000 npm start
```

The operation command prints each reviewed operation name and its SHA-256 document hash. Copy the `PlateOverview` hash into this request:

```sh
curl http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/graphql-response+json' \
  --data '{"extensions":{"persistedQuery":{"version":1,"sha256Hash":"COPY_PLATE_OVERVIEW_HASH"}},"variables":{"id":"NVSX-2026-118","first":12}}'
```

The hashes identify exact query documents. They are ordinary public lookup keys, with no authentication role and no relationship to mutable record fingerprints. Adding or changing a reviewed `.graphql` document changes the operation inventory at the next build/deployment. The server accepts the deployed inventory and has no registration endpoint.

For local schema exploration, run `NODE_ENV=development GRAPHQL_EXPLORER=1 npm start` after building. This explicit mode binds to `127.0.0.1` and enables GraphiQL and arbitrary queries. Production ignores the flag.

## Source ownership

| Owner | Responsibility |
| --- | --- |
| `src/app/data` | Canonical synthetic corridor, plate, result history, and file fixtures |
| `src/server/example-data.ts` | Build-time read projection of those same fixtures |
| `vite.server.config.ts` | Generates `build/server/example-data.mjs` outside public `dist` |
| `server/graphql/schema.graphql` | Typed query, record, enum, nullability, and connection contract |
| `server/graphql/schema.mjs` | Membership-gated workflow context and scoped Plate relationship resolvers |
| `shared/permission-scope.mjs`, `services/permissionScope.ts` | Shared policy, immutable canonical catalog, grant replay and record/field projection |
| `server/data` | Example/MySQL repositories, request connection scope and explicit schema setup |
| `shared/plate-records.mjs` | Bounded canonical record decoding shared by server and browser |
| `server/graphql/pagination.mjs` | Bounded, collection-scoped forward paging |
| `server/graphql/operations` | Reviewed production query documents |
| `server/graphql/operations.mjs` | Validated operation inventory and standard SHA-256 document identity |
| `server/graphql/api.mjs` | Yoga HTTP handling, persisted-operation plugin, request limits, and error policy |
| `scripts/build.mjs`, `scripts/serve.mjs` | Browser/private server projections and ordinary Node startup |

The baseline is loaded once per server process. Lanes follow lane order, cards follow their position, wells follow row/column order, and histories follow `sequence`. Example maps keep fixture reads direct. MySQL reads use a request-owned connection and read-only transaction, bounded queries, batched history artifacts and a request-local result cache. The scoped adapter also reuses canonical well reads within that request, keeping relation checks on the same snapshot without repeated anchor queries. Corridor reads retain the fixture source and open no database connection.

Well IDs are plate-local coordinates: pass both `plateId` and `id` to read a well. A result retains its anchor `wellId` separately from its physical run plate and well. A reused file keeps the same `File.id` object key across results; each result owns its own artifact reference and `reusedFrom` relationship. Byte sizes use `Float` because many example objects exceed GraphQL's signed 32-bit `Int`; they remain integer byte counts in the baseline.

Lookup fields return `null` when a valid ID has no record. Collections return an empty connection when their permitted projection contains no records. A known direct record outside the scope returns a tagged `FORBIDDEN` error; missing records remain distinct. Fields and references are projected before connection counts and paging. Invalid input yields a GraphQL error; unexpected adapter failures are masked in the HTTP response while the server logger retains the diagnostic. Non-null relationships express fixture invariants, so a broken owned relationship surfaces as an error instead of silently disappearing.

## Request boundaries

Production executes seven finite read documents: corridor lanes, cards, connections, plate wells, well history, result artifacts, and `PlateHistory`. The last provides a complete, bounded selected-well projection with `dataSource.mode` and `asOf`, including the current well, permitted metrics, lineage and artifact state. Its browser hash is checked against the deployed document. Other reads retain separate history/artifact paging. All documents keep selection depth fixed. Adding a document earns a review of both its relationship fan-out and its variable bounds.

| Boundary | Behavior |
| --- | --- |
| Page size | Default 20, maximum 50; operation defaults may be smaller |
| Cursor | Opaque collection-and-policy-scoped identity, maximum 512 characters; malformed or cross-scope cursors yield `BAD_USER_INPUT` |
| Lookup ID | 1–160 characters |
| Request body | 16,384 bytes, including chunked input; oversized streams receive 413 or the Node adapter closes the connection |
| Execution deadline | 5 seconds through the maintained server adapter; deadline yields 504 and aborts `request.signal` |
| Request/header receipt | 10 seconds through Node's HTTP server |
| Documents | Registered hashes only; raw queries, unknown hashes, and batched operations are rejected |
| Uploads/cross-origin client access | Multipart requests and CORS headers are disabled |
| Errors | Expected input errors remain legible; internal diagnostics stay in server logs |

Collection reads check the request signal; MySQL request scope cancels its owned transport and releases the connection in `finally`. The deadline returns a response and signals cancellation; it cannot preempt CPU-bound JavaScript. HTTP admission limits and fixed documents bound the current work without adding a general complexity engine or speculative caches.

Production requests may include `extensions.scenario` alongside the persisted query: `{ version: 1, principalId, roleId, environment, grantChanges }`. Omission selects the default Research scenario. Unsupported shapes or commands are rejected. Grant changes carry a validated actor selection, target principal, resource, geography and level; the server derives effective access by replaying them against the canonical catalog. A raw client matrix or capability claim grants nothing. The scope is immutable for the lifetime of the request.

The generic Corridor describes shared synthetic workflow and checks read capability and environment membership. Plate wells, results and artifacts use canonical geography, classification, consent and resource grants. Minimum timeline metadata stays separate from clinical text and files. [The permission contract](permission-scenarios.md) owns that field policy and the distinction between explanation and analysis. The scoped repository filters before counts and paging; direct and nested references pass through the same projection. Indexed, parameterized MySQL reads and request cleanup retain their existing ownership.

The browser sends its accepted finite scenario, partitions history caches by the normalized policy scope, and cancels obsolete requests. `FORBIDDEN` suppresses fixture fallback. `OWNERSHIP_UNAVAILABLE` identifies unknown or conflicting canonical ownership and suppresses both cache and examples until a successful retry. Missing and empty histories also replace previous examples. A retryable transport/storage failure retains only currently permitted example data. Current stored-well metadata replaces its bundled counterpart together with its history.

Hosting supplies server-only database credentials. The synthetic catalog remains public showcase material; this scenario protocol establishes consistent behavior rather than verified identity. Durable writes, subscriptions, federation and AI services retain separately approved boundaries. GraphQL and MySQL packages remain server-only.

## Evidence and deployment

After `npm run build`, run `npm run test:graphql`, `npm run test:deployment`, and `npm run test:startup`. The HTTP checks cover useful scoped reads, filtered pagination and relationships, held explanations, field omission, grant replay, result/file identity, missing and empty results, rejected documents, variable/body bounds, masking, the deadline, local exploration, static/source isolation, and rebuilding both projections through the legacy hosting entry. Startup checks observe the actual emitted browser graph.

The reviewed source and frozen dependency graph produce both browser and private server projections. `npm start` fails clearly if either projection is missing. [Node deployment](deployment.md) and [local clone operations](runbooks/local-postgresql-clone.md) name the supported delivery and recovery routes.

## Research decision

Yoga 6.1 and GraphQL.js 16.15 provide the maintained HTTP/parser/schema layer on the supported Node 22 runtime. Yoga's persisted-operation plugin implements the reviewed-document gate; its body-size limiter counts streamed bytes; the underlying maintained server adapter supplies a request deadline. This keeps transport mechanics in maintained owners while the application owns its schema, finite operation set, and data semantics.

The decision follows [GraphQL demand control](https://graphql.org/learn/security/), [schema design guidance](https://graphql.org/learn/schema-design/), [GraphQL over HTTP](https://graphql.github.io/graphql-over-http/draft/), [Yoga production guidance](https://the-guild.dev/graphql/yoga-server/docs/prepare-for-production), [persisted operations](https://the-guild.dev/graphql/yoga-server/docs/features/persisted-operations), [Yoga's maintained release notes](https://the-guild.dev/graphql/yoga-server/changelogs/graphql-yoga), and the [server adapter's deadline implementation](https://github.com/ardatan/whatwg-node/blob/master/packages/server/src/plugins/useRequestDeadline.ts). The [GraphQL.js DataLoader guidance](https://www.graphql-js.org/docs/n1-dataloader/) describes the database batching problem; the example indexes avoid that problem, and the stored-history adapter batches artifact reads and reuses request-local result values.
