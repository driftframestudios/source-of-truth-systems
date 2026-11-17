---
name: scoped-record-boundaries
description: Aligns canonical record commands, read projections, and cache publication under current permission scope. Applies when stale callbacks, relationship aliases, stored metadata, or scenario changes can disagree about which records and actions are available.
---

# Scoped record boundaries

## Contract

- **What:** Carry one canonical record identity through current authorization, visible projections and accepted effects.
- **When:** A control, GraphQL read, cache, count or related-record link bypasses or captures an outdated scope decision.
- **Boundaries:** Browser persona selection demonstrates public example policy; it is not verified human identity. Hosted workspace ownership has its own server boundary. This skill does not introduce accounts, grants or clinical rules beyond the task.
- **Result:** Every receiving view and command agrees on the current permitted record, including explicit denial and missing data.

## Fit and attention

- **Useful when:** An enabled action outlives its permission decision, a stored record replaces a bundled anchor, or hidden records remain visible through counts, aliases or cache publication.
- **Poor fit when:** A purely decorative change never changes data or authority. Authentication design and clinical eligibility policy require their separately authorized decisions.
- **Smallest useful dose:** Follow one command or relation from canonical identity through fresh policy, accepted effect and its visible consumers.
- **May under-attend:** Projection agreement establishes application policy behavior. Verified human identity, legal compliance and external clinical suitability need their own evidence.
- **Interactions:** [Async draft recovery](../async-draft-recovery/SKILL.md) preserves edits through delayed acceptance; [responsive intent handoff](../responsive-intent-handoff/SKILL.md) carries permitted selection across renderers. Neither replaces authorization here.

## Inputs, defaults and output

Read the canonical record owner, policy functions, current actor/scenario reader, command and related read/cache consumers. Identify:

| Input | Decision it controls |
| --- | --- |
| Canonical record and ownership metadata | Which consent, geography, classification and relationships govern this record? |
| Acting scope | Who submits the action, in which environment and role? |
| Requested operation | Which capability and legal transition apply? |
| Record identity versus shared object identity | What must be authorized, and what effect can be deduplicated? |
| Read outcome and captured scope | Which authoritative values may replace examples, and where may the response publish? |

Use current policy and source metadata. If canonical ownership is unavailable, preserve the explicit denial/unavailable receiver until it can be resolved; a guessed relationship supplies no authority. The output is a source-grounded command/projection repair and an observation that distinguishes allowed, refused, missing or obsolete input. A new global permission framework is unnecessary when the shared owner already fits.

## Rules

### Rule: The command resolves facts; the view expresses intent

Pass record identity and the requested operation to an accepted-state owner. Resolve current metadata, ownership, consent and legal transition there, then check current authority immediately before the effect. A previously enabled button or successful preview is not a later grant. A displayed or inspected person is distinct from the actor submitting a change.

### Rule: Identity has more than one useful key

A result's record identity can carry consent while several results reference one physical file. Deduplicate a file restore by its physical object key while authorizing each initiating result against its own canonical owner. Choose the identity matching the operation instead of spreading one convenient ID across every layer.

### Rule: Project the whole visible relation

Filter records, fields, counts, stories and relation targets from the same current scope. A hidden target can otherwise remain discoverable through an alias or summary. Stored metadata replaces its bundled anchor, including an explicitly missing well or empty history. Denial and authoritative unavailability suppress fallback; successful retry reopens the receiving path. Distinguish an authoritative unavailable record from a transport exception: the latter reports a failed read without inventing an empty record or a new permission grant. The existing receiver owns whether previously permitted cached data remains visible.

### Rule: Partition and publish independently

A cache key identifies the scope that produced a read. Publication also checks that the current scope still matches when the response arrives. Abort reduces obsolete work, but a current-scope check protects the gap before effect cleanup. Scope-neutral repository reads and request-owned projections keep policy from contaminating shared raw data.

## Operating sequence

1. **Locate authority:** Name the record and actor that the command resolves at acceptance. Distinguish an inspected person from the person submitting a grant change.
2. **Follow identity:** Trace record IDs, relation IDs and physical-object keys through the operation. Choose a key for each job instead of treating display identity as universal.
3. **Inspect acceptance:** Find the current-scope read immediately before the effect. Check the legal transition and already-accepted outcome alongside authorization; an earlier preview remains advisory.
4. **Inspect projection:** Follow the same record into lists, counts, stories, indexes and relation targets. Verify that a denied or missing target leaves those routes through the shared projection.
5. **Inspect publication:** Partition reads by producing scope and compare captured/current scope again at response acceptance. Abort conserves work; publication checks protect the interval before effect cleanup.
6. **Observe the boundary:** Choose the plausible fault: scope changes after preview, a late read crosses scope, or stored ownership contradicts an example. Assert the accepted effect and visible relation independently, using the existing layer that owns each.
7. **Return:** Explain the permitted behavior, current refusal and retry/return route. Separate source inspection, executed policy assertions, browser projection and hosted identity claims.

## Local receivers

- [Shared permission scope](../../../shared/permission-scope.mjs) and [current write gate](../../../src/app/services/writeGate.ts): policy and fresh scenario access.
- [Plate commands](../../../src/app/components/plate/plateCommands.ts): canonical resolution, capability distinctions and physical-file effects.
- [Scoped server repository](../../../server/data/scoped-repository.mjs) and [history cache](../../../src/app/services/plateHistory/cache.ts): request projection and late-publication boundaries.
- [Scoped client observations](../../../tests/scoped-client.test.mjs) and [permission contract](../../../docs/permission-scenarios.md): covered failures and standing scope semantics.

The scoped-client cases cover actor/inspected-target separation, late publication before effect cleanup, revoked indexes/aliases and stored-anchor replacement. [Plate command cases](../../../tests/plate-commands.test.mjs) own current-record acceptance and shared physical-file effects. [Server read cases](../../../tests/scoped-reads.test.mjs) and [scope browser journeys](../../../tests/browser/permission-scope-scenes.spec.mjs) supply their respective projection observations. These are executable coverage owners, not an assertion that they ran during this invocation. Use the [local writing guide](../declarative-skill-authoring/references/writing-and-evidence.md) when refusal messages or substantial handback prose change.

## Authored routing example

- **Given:** A restore preview is allowed for a result, and several results reference the same file.
- **When:** Canonical consent or acting scope changes before acceptance.
- **Then:** The command resolves the current initiating result and returns its current refusal before starting a restore. Another permitted result may independently authorize the shared-file operation; its readable alias remains subject to that result's policy.

This authored scenario clarifies authorization versus deduplication. The linked command and projection tests establish their asserted cases; the example leaves untested alias combinations unspecified.

## Recovery and re-entry

When policy changes, derive the new projection and discard obsolete publications while retaining unrelated accepted work. Offer a current permitted record or the existing retry when an authoritative read becomes available. For stale edit intent, preserve the draft through its editor owner and recheck authority on the next submission. A missing identity mechanism remains a separately scoped decision; browser persona controls continue to describe public examples.

## Completion

Complete when current commands and projections agree, obsolete reads stay outside the receiving scope, and the affected refusal has a truthful return path. Re-enter when canonical ownership, an action capability, a relation consumer or an identity boundary changes. Keep purely visual work with its existing rendering owner.
