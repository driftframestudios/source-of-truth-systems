# Shared record and policy contracts

This directory carries small runtime contracts consumed by both server and browser. Keep them independent of React, hosting credentials and database clients. The matching `.d.mts` files describe their TypeScript shape; the `.mjs` functions perform actual runtime decoding or policy work.

| Owner | Meaning | Representative check |
| --- | --- | --- |
| [permission-scope.mjs](permission-scope.mjs) | Canonical scope, bounded scenario replay and record/field projection | [scoped-reads](../tests/scoped-reads.test.mjs), [permission policy](../tests/permission-policy.test.mjs) |
| [plate-records.mjs](plate-records.mjs) | Decoded plate, well, result and physical-file identities | [plate-records](../tests/plate-records.test.mjs) |
| [plate-history-operation.mjs](plate-history-operation.mjs) | Shared selected-history operation identity | [GraphQL](../tests/graphql.test.mjs), [history client](../tests/plate-history-client.test.mjs) |

When a shape changes, trace both receiving sides. Type declarations alone cannot validate a network record, and a client-provided capability does not replace canonical permission checks. Keep a successful empty or missing record distinct from an unavailable source; ensure caches and consumers receive the same accepted meaning. The [scoped-record skill](../.agents/skills/scoped-record-boundaries/SKILL.md) gives a focused reasoning route.

Use [Tests](../tests/README.md) for prerequisites: some source/domain cases run directly after installation, while HTTP and build-output cases require `npm run build`. [GraphQL](../docs/graphql-read-api.md), [permission scenarios](../docs/permission-scenarios.md) and [persistent data](../docs/persistent-data.md) hold the full contracts.

[Documentation](../docs/README.md) · [Repository](../README.md)
