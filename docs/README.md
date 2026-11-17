# Documentation

Use the application to explore synthetic life sciences workflows, then follow the route that matches what you want to build or understand. The Markdown files here are the current documentation source. The ordinary build also serves selected articles at `/docs/`; the same source can build at the root of the independent foundation site. [Documentation implementation](site/implementation.md) names the manifest, profiles and source-derived GraphQL reference.

## Start and try

- [Getting started](getting-started.md): local example, a sample walkthrough, Node API and one focused test.
- [Fixture provenance](fixture-provenance.md): synthetic records, supplied findings and scenario-policy boundaries.
- [Database choices](database-choices.md): supported PostgreSQL and bundled examples, with retained MySQL compatibility, plus optional graph/RDF/object-store extensions.
- [Local PostgreSQL clone](runbooks/local-postgresql-clone.md): start, stop, backup, restore and reset an isolated persistent example.
- [PostgreSQL](postgresql.md): server configuration, explicit schema/seed ownership, bounded transactions and recovery.
- [Deployment](deployment.md): ordinary Node serving, isolated PostgreSQL, bundled examples and the Figma Make adapter.

## Change and extend

| Reader task | Source route | Related contract |
| --- | --- | --- |
| Add a scene or preserve edits across responsive views | [Application](../src/app/README.md) | [Mobile](mobile-showcase.md), [workspace layout](workspace-layout.md), [loading](loading-experience.md) |
| Add a read or inspect persisted data | [Server](../server/README.md) | [GraphQL](graphql-read-api.md), [catalog](persistent-data.md), [visitor workspaces](visitor-workspaces.md) |
| Change permissions or a shared record shape | [Shared contracts](../shared/README.md) | [Permission scenarios](permission-scenarios.md), [input boundaries](research/input-boundaries.md) |
| Choose a useful test or investigate a failure | [Tests](../tests/README.md) | [Automation](development-automation.md), [selective checks](runbooks/selective-check-delivery.md) |
| Deliver, maintain dependencies or recover setup | [Runbooks](runbooks/README.md) | [Node deployment](deployment.md), [publication scan](runbooks/publication-scan.md), [database recovery](runbooks/local-postgresql-clone.md) |

## Understand an interaction

[Specimens](specimen-table.md), [Source records](source-discovery.md), [comparisons](comparison-decisions.md), [release records](release-workflows.md), [Map and QC](operational-workflows.md), [Artifacts](artifact-operations.md), [Cohort rules](cohort-rules.md) and [Profile](profile-preferences.md) name their accepted effects and recovery. [The workspace assessment](workspace-audit.md) connects these families without treating every visible control as an external operation.

[Theme](theme-contract.md), [Plate layout](plate-workspace.md), [compact records](compact-records.md) and [presentation styles](presentation-styles.md) describe composition and paint. [Shareable navigation](shareable-navigation.md) records bounded URLs, Back/Forward and Source draft continuity. [Guided exploration](research/guided-exploration.md) explains the optional walkthrough's control handback. Research documents preserve the source and reasoning behind a decision; their dated observations stay distinct from a check of a new revision.

## Source and publication

Edit an owning Markdown document rather than generated output. The ordinary build generates `/llms.txt` and `/llms-full.txt` from the population in [the content manifest](content-manifest.json): root Markdown, `LICENSE`, `docs/`, `guidelines/`, `.agents/skills/`, admitted articles and the generated schema reference. That public bundle includes development guidance; it grants no runtime authority. Nearby READMEs under source directories remain repository reading routes, linked from this index. [Attributions](../ATTRIBUTIONS.md) and [the license](../LICENSE) retain their own roles.

Human and AI-assisted contributors can use the local methods in [AGENTS.md](../AGENTS.md). Required operating guidance lives in this clone; public research references supply additional context.

[Return to the repository](../README.md)
