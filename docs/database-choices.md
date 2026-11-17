# Choose a database for an adaptation

The public edition uses PostgreSQL for its persistent synthetic example and retains a bundled-example route for immediate exploration. The source implements the catalog and visitor-workspace adapters; the [isolated Compose clone recipe](runbooks/local-postgresql-clone.md) provides the complete receiving setup. [PostgreSQL setup](postgresql.md) documents the executable native route and its recovery boundaries.

Public setup and release acceptance focus on PostgreSQL and generic Node hosting. Each clone owns its own records and credentials. The source also retains a MySQL adapter for explicitly selected compatibility work.

## What runs today

| Route | Behavior in the current source | Receiving owner |
| --- | --- | --- |
| Vite source development | Bundled records and browser-local workflow edits; this process does not host either GraphQL API | [Getting started](getting-started.md#start-the-local-interface) |
| Node with database settings absent | Scoped GraphQL reads over the synthetic baseline; Source edits remain local to the browser session | [Server](../server/README.md) and [configuration](../server/data/connection.mjs) |
| Optional compatibility: Node with complete MySQL settings and explicit setup | Stored Plate, well, result and file metadata; an independently installed workspace schema can retain bounded Source metadata edits | [Stored data](persistent-data.md), [visitor workspaces](visitor-workspaces.md) |
| Node with explicit PostgreSQL settings and setup | The same stored Plate and expiring Source contracts through PostgreSQL 18 | [PostgreSQL](postgresql.md) |
| Incomplete settings or an unavailable configured database | A visible configuration or stored-data failure; the server preserves that failure instead of silently substituting examples | [Read API](graphql-read-api.md) and [workspace storage](workspace-storage.md) |

Complete `DB_*` settings select the retained MySQL adapter. `DATABASE_PROVIDER=postgres` with complete `PG*` settings selects PostgreSQL; mixed or incomplete configuration receives an explicit error. The current Source store saves title, description and tags with revision checks, exact retry receipts and bounded history. Other accepted workflow edits retain their browser-session owners. File records describe object identities and locations; the application does not currently upload or retrieve assay binaries.

GraphQL is the application's typed API boundary. It can resolve relationships from relational tables, a property graph or another owned adapter. Its presence alone creates neither a graph database nor an ontology.

## Start with PostgreSQL for persistent examples

PostgreSQL fits the first adaptation because the existing operations already depend on explicit identities, related records, constrained updates and transactional acceptance. Keep frequently joined or filtered identities and ownership fields in ordinary columns with keys and constraints. Use bounded `jsonb` fields for variable metadata when their actual reads justify that shape; choose targeted indexes after inspecting those reads. PostgreSQL documents both `jsonb` containment/indexing and its differences from byte-preserving `json`. A JSON document remains subject to the application's schema and size checks. [PostgreSQL JSON types](https://www.postgresql.org/docs/current/datatype-json.html)

The PostgreSQL adapter implements the existing read and command contracts. [Canonical seed preparation](../server/data/prepare-catalog-seed.mjs) is shared across engines; dialect-specific schema, locks and transactions retain explicit owners. Repeat setup preserves accepted data, and normal startup reads the installed schema. [The adapter contract](postgresql.md) records snapshot isolation, cleanup, type normalization and tested failure/recovery paths.

For local operation, the reviewed Compose recipe keeps the database on its internal network and publishes the app on loopback. Each checkout receives a random project identity, private generated credentials and a named volume, including checkouts whose directories share a basename. Startup waits for database health and explicit schema/seed validation. Separate stop, backup, restore and confirmed reset commands make their data effects visible. [Local operations](runbooks/local-postgresql-clone.md) owns the tested commands. [Docker database seeding](https://docs.docker.com/guides/pre-seeding/) supplies background on fresh-volume initialization.

Carry the Source workspace contract across engines: opaque cookie authority, origin and expiry scope, current permission checks, expected revision, idempotency identity, atomic projection/history writes, quotas and explicit reset. Keep idempotency fingerprints tied to the shared normalized command representation; `jsonb` key ordering must not become their authority. A stored workspace is a bounded sandbox for synthetic edits, not a verified clinical identity. [Workspace contract](visitor-workspaces.md)

## Add a graph only when traversal earns it

A property graph can help when the receiving question follows several kinds of relationships—for example, from a sample through derived files, analyses and decisions—and the required paths vary across investigations. PostgreSQL remains a reasonable starting point for fixed joins and bounded recursive queries. Evaluate a separate Neo4j projection only when representative traversal queries, update ownership and measured execution make its extra service worthwhile.

The Neo4j GraphQL Library can derive a GraphQL API and translate operations to Cypher. Its generated API would be an explicit adaptation, not a replacement for this application's finite approved operations. Any integration must carry current identity, consent, geography and workspace scope into both direct and nested reads, bound traversal cost, and retain the command owner for writes. Choose whether relational records remain authoritative and how the graph catches up before introducing a second writable copy. [Neo4j GraphQL Library](https://neo4j.com/docs/graphql/current/)

## Use RDF for shared meaning and interchange

RDF is a different extension: named relationships and shared vocabularies can connect an assay, organism, provenance record or external identifier across independently maintained systems. RDF represents statements as triples and uses IRIs for identity; vocabularies supply agreed terms. That can serve ontology alignment or interchange even when transactional application records remain relational. [W3C RDF primer](https://www.w3.org/TR/rdf11-primer/)

SPARQL provides the query route; add OWL ontology axioms and entailment only when the receiving task needs those inferences. Select the supported reasoning profile and distinguish asserted relationships from inferred ones in the returned evidence. [SPARQL overview](https://www.w3.org/TR/sparql11-overview/) · [OWL 2 overview](https://www.w3.org/TR/owl2-overview/)

Choose the actual vocabulary, identifier mapping, provenance and validation rules with the receiving domain. An RDF export or bounded read projection is a smaller first step than a second writable store. Imported ontology assertions need their own provenance and versioning; an inferred relationship does not establish a person's authorization to read its underlying records. This repository currently provides neither an RDF adapter nor a SPARQL endpoint.

## Keep assay objects outside the transactional rows

Large sequence, alignment, image and report objects belong in an appropriate object store or file service. The database should retain stable object identity, version, media type, size, checksum, provenance and the governed access relationship. A storage locator is a reference, not permission to fetch the object. Resolve access at the server boundary and keep credentials and expiring signed URLs outside source fixtures, public documentation and durable audit text.

The current example's object keys and file-status records support visual exploration. A real object-store integration would also need upload/download behavior, integrity verification, lifecycle handling and a receiving access-policy check. Preserve the synthetic baseline while designing that separate capability.

## Receive the persistent clone

The adapter delivery establishes native PostgreSQL behavior with focused real-engine checks. The clone recipe adds a pinned Compose service, per-clone identity, generated local credentials, bounded readiness, and tested backup/restore/reset commands. Its acceptance includes application/database restart and retained edits in a materialized receiving overlay.

Choose hosting independently of data modeling. A local recipe establishes its tested environment; a managed host supplies its own certificate, role, backup and receiving-deployment observations. Review component licenses when adapting or redistributing the application. The repository's MIT license leaves upstream component terms with their owners. [Deployment](deployment.md) and [attributions](../ATTRIBUTIONS.md) keep those decisions visible.

[Documentation](README.md) · [Run the example](getting-started.md)
