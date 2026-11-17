# Permission behavior and coherent exploration

The application makes each permission choice visible in the operation it governs. The shared typed policy evaluates the selected actor, requested action, canonical resource and environment to produce an explicit allow/refuse result. Controls preview that decision; accepted command owners evaluate it again before changing state.

This research supports the [workspace assessment](../workspace-audit.md). The inspected application publishes synthetic examples. Browser persona selection demonstrates policy; private records require a separately designed verified server identity boundary.

## Findings and current response

**Supersession:** the original audit found a fixed first-principal gate, caller-only workflow checks, view-local grants and unrestricted public read projections. The delivered scenario, command and read owners replace those findings. [The scenario contract](../permission-scenarios.md) records current boundaries.

Persona selection (#66) supplies the acting context. Canonical command checks (#69) protect record and Plate effects. Scoped grants, GraphQL reads and policy-partitioned histories (#70) use the same finite scenario. Source and workflow operations (#60/#71) now retain accepted local results, and Profile's appearance and optional-toast preferences reach their consumers. [Action delivery](action-delivery.md) names each feature owner and its bounded effect.

A control's enabled appearance previews permission; the receiving command or API still evaluates its current inputs. Grant-experiment recovery remains in #103, and verified identity remains a separate future contract.

## Options and synthesis

| Option | Useful contribution | Decision |
| --- | --- | --- |
| Wire the existing controls only | Immediate visible feedback | Bounded controls now delegate accepted effects to shared feature owners |
| Shared scenario, capability sets and command services | Coherent local behavior with inspectable rules | Delivered local foundation |
| Apply the same policy to GraphQL reads | Consistent lists, IDs, relationships and counts | Delivered in #70 |
| Verified identity and durable policy administration | Authority for nonpublic records and multiple real users | Future explicit identity contract |
| SQL users or views as primary browser policy | Stable database projections and account privileges | Optional receiving need; the current shared account cannot identify a browser persona |

Use explicit capability sets for jobs, ordered rules for overlapping permission conditions, and existing transition tables for workflow legality. The current implementation uses typed capabilities and rules within the existing service owners. Audience perspective selects a reading focus; it remains independent of grants. A person's home region, a record's geography and the hosting region have distinct meanings.

## Receiving contracts

1. **Accepted commands (#69), delivered.** Distinguish sample, order, clinical review, restore and query-repair capabilities. Resolve canonical resource metadata at the owner. Recheck the current scenario immediately before acceptance, including after a preview or confirmation. A refusal preserves records and timers. Shared-file identity remains separate from each result's consent.
2. **Read projection (#70), delivered.** The shared policy filters receiving lists, counts, nested links and direct-ID returns; any future export must use the same projection. An authorized audit view can retain evidence explaining a consent hold while withholding the held operation. Grant editing evaluates the acting principal separately from the inspected principal.
3. **GraphQL context (#70), delivered.** The server derives finite showcase personas and grants; client capability claims carry no authority. History cache identity includes policy scope, scope changes cancel obsolete requests, and refusal has its own result. A denied read must never fall back to the unrestricted catalog. A transport failure can still offer an explicitly allowed example projection.
4. **Visible actions (#60, #71), delivered.** Typed feature owners accept source, release-record, Map/QC, artifact and cohort operations; Profile settings connect to consumed presentation behavior. Each retained control performs a bounded local operation, offers a real next step, or states availability. Success copy names the accepted local effect. A showcase notification must not imply an external connector, clinical sign-off, cloud restore or durable audit event ran.

## SQL and deployment decision

Retain the current prepared base-table reads, request-owned connection and read-only transaction. For the retained MySQL adapter, `SQL SECURITY INVOKER` evaluates its database account. A shared runtime login cannot identify the selected browser persona. The same distinction applies to PostgreSQL view ownership and application scope. Views may later package explicit columns or support a restricted application account; they complement application policy.

A future view needs a concrete query consumer, confirmed hosted version and grants, explicit columns, ordinary-account `EXPLAIN` and result comparison, and a versioned setup/recovery path. Account-specific `DEFINER` clauses remain outside portable setup files. The accepted setup-ZIP and ordinary ZIP path stays in place; the earlier dashboard import failure is not a prerequisite to reopen.

## Evidence and consequences

| Primary source | Local consequence |
| --- | --- |
| [GraphQL authorization](https://graphql.org/learn/authorization/) | Put authorization in a shared business/service layer; registered query shapes are a separate boundary from identity and resource access |
| [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny unsupported inputs, check resource scope and enforce at each effect; include direct command and direct-ID observations |
| [Yoga request context](https://the-guild.dev/graphql/yoga-server/docs/features/context) | Carry immutable derived policy alongside the request-owned repository |
| [Yoga response caching](https://the-guild.dev/graphql/yoga-server/docs/features/response-caching) | Partition viewer-dependent results; the current browser cache needs the same scope even without a server cache plugin |
| [MySQL view security](https://dev.mysql.com/doc/refman/8.4/en/create-view.html) | Treat SQL account authority separately from browser actor identity; verify the actual hosted version and privileges for any later view |

The initial source reading established the disconnected owners and allowed no-op paths. Focused executable cases and production-browser journeys establish the delivered commands, scoped reads and recovery paths. This research did not inspect private records, hosted grants or remote execution plans, and it makes no clinical-compliance claim.

## Language and Welcome

The [whole-view audit](../workspace-audit.md) classifies language by its job. Supported actions lead operational guidance; future work occupies its own sentence. Exact consent, privacy, legal and access exclusions retain their meaning. Quotations and stored identifiers remain faithful. This improves inspectability for people; a future AI receiver needs its own representative behavior observations before claiming improved instruction reliability.

Welcome (#53) is directionally approved. Its question branches should describe working routes: finding a sample, understanding a rerun, comparing data availability and explaining resource trade-offs. The next Welcome implementation cue follows the coherent receiving operations; AI-assisted presentations remain a separate discussion (#19).
