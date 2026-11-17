---
name: async-draft-recovery
description: Separates submitted drafts, accepted records, and remote workspace lifetimes during asynchronous edits. Applies when lost responses, hydration, conflict, reset, expiry, or reopened editors can overwrite newer work or misreport whether an edit was saved.
---

# Async draft recovery

## Contract

- **What:** Preserve a recoverable draft while accepting only the response that belongs to its record, editor and workspace lifetime.
- **When:** Saving becomes asynchronous or an existing editor crosses hydration, retry, reset, scope or workspace replacement.
- **Boundaries:** This method preserves edit intent and truthful feedback. Fresh authorization remains at the command boundary; transport failure supplies no authority to accept a local substitute. Ordinary synchronous inputs need less structure.
- **Result:** The visitor can distinguish accepted work from a retained draft and retry or revise without an older completion closing newer work.

## Fit and attention

- **Useful when:** Cancel and reopen race a Save response, a retry may repeat a committed command, or local and hosted revisions share a display but have different lifetimes.
- **Poor fit when:** A synchronous field update has one owner and no delayed acceptance. A cosmetic loading change stays with its component when acceptance is already coherent.
- **Smallest useful dose:** Trace one reordered sequence and repair the identity or publication check that distinguishes its two outcomes.
- **May under-attend:** Draft recovery leaves authorization, transaction durability and contention with their command and storage owners.
- **Interactions:** [Scoped record boundaries](../scoped-record-boundaries/SKILL.md) owns current authority; this skill owns the editor and response relationship.

## Inputs, defaults and output

Read the editor, accepted-state owner, transport outcomes and server receipt contract. Identify values that actually change independently:

| Identity | Question it answers |
| --- | --- |
| Record ID and revision | Which accepted record did the visitor edit? |
| Editor instance or generation | Which open draft may receive completion feedback? |
| Workspace identity and generation | Which namespace owns these revisions and retries? |
| Read sequence | Which hydration request is current within that namespace? |
| Scope generation | Does the action still belong to the current permission scenario? |
| Normalized command identity | Is this the same submitted intent or a newly edited command? |

Use the identities needed by the actual workflow. Keep the draft while acceptance is uncertain. If the server lacks a receipt contract, establish its retry behavior before describing a retry as safe. The output is a bounded ownership repair and an observation of both the accepted record and editor; a new state framework is optional.

## Rules

### Rule: Track the identities that can change independently

Record revision, editor instance, workspace identity, request order and scope generation answer different questions. Reopening the same record creates a new editor lifetime even when its record ID is unchanged. A new hosted workspace creates a new revision namespace even when its first revision is lower than a local record's revision.

### Rule: Hydrate before deciding against accepted state

Resolve the current persistence mode and accepted snapshot before submitting. An explicit local mode permits local acceptance. Outage, expiry, denial and absent installation retain distinct outcomes. Replacing a workspace resets its projection and retry identities before merging; within one workspace, older revisions cannot replace newer accepted records.

### Rule: An uncertain response preserves exact retry identity

A lost response does not establish that a command failed to commit. Retain the identity of the same normalized intent and expected revision for retry. Changed intent gets a new identity. Server receipts own duplicate acceptance; client identity alone provides no exactly-once guarantee. Conflict refreshes accepted state while keeping the draft available for review.

### Rule: Completion belongs to the submitted editor

Either freeze submitted fields while a save runs, with Cancel available, or explicitly separate subsequent editing from the submitted snapshot. Guard close, success notices and draft replacement by the submitting editor generation. Cancelling a view withdraws its UI effects; it does not assert cancellation of an already accepted server command.

### Rule: Recovery stays explicit

Expiry and reset invalidate older hydration and mutation responses. Starting another workspace is a new action, not silent replay of the old save. Accepted history describes what was confirmed; a timeout message keeps the draft and offers a truthful retry.

## Operating sequence

1. **Reconstruct:** Write submit → close/reopen → response, or hydrate → reset → late snapshot. Record the initial accepted revision and visible draft separately.
2. **Assign:** Name the owners of accepted data, submission identity, editor and notice. Find the await or callback where each can become stale.
3. **Discriminate:** Decide whether a late result may update accepted state, editor state, both or neither. A confirmed result can remain useful after its editor closes, subject to current workspace and scope.
4. **Repair:** Add the missing boundary at that owner. Reuse existing normalization, permission preparation and server receipts rather than duplicating them in the component.
5. **Observe:** Hold one response, make the competing change, then release it. Inspect accepted text/revision, the current draft and notice independently. For namespace replacement, use a lower incoming revision to distinguish it from ordinary monotonic merging.
6. **Return:** Name the repaired sequence and its retry, refresh or restart action. Source review establishes the owner path; an executed test establishes the reordered case it asserts.

## Local receivers

- [Source workspace owner](../../../src/app/services/sourceWorkspace.ts): hydration, workspace generations, monotonic merge and retry identity.
- [Source editor](../../../src/app/components/SourceMetadataEditor.tsx) and [Sources receiver](../../../src/app/components/views/SourcesView.tsx): submitted fields, retained draft and editor-generation guards.
- [Workspace store](../../../server/workspaces/store.mjs): transactional receipts and revision acceptance.
- [Owner observations](../../../tests/source-workspace.test.mjs), [browser journeys](../../../tests/browser/source-workspace.spec.mjs), and [workspace contract](../../../docs/visitor-workspaces.md): actual recovery routes and coverage.

The owner tests cover explicit LOCAL mode, ambiguous retry, stale hydration, conflict, scope changes and first hosted hydration below the local revision. The held-response browser case asserts frozen submitted fields, Cancel while pending, blocked reopening during that request, and reopening with accepted text after settlement. It requires the separate disposable database route. Guarding a newer editor against an older completion remains a design invariant supported by the editor-generation source checks; that browser case does not exercise two overlapping editor instances. [SQL workspace cases](../../../tests/mysql-workspaces.mjs) own transaction and receipt observations. These links identify existing assertions, not a claim that they ran during every skill use. Use the [local writing guide](../declarative-skill-authoring/references/writing-and-evidence.md) when recovery messages or substantial handback prose change.

## Authored routing example

- **Given:** Local metadata has revision 1 and the first hosted snapshot has revision 0 in a newly identified workspace.
- **When:** Hydration receives that snapshot.
- **Then:** The owner installs the hosted namespace before applying its revisions. A revision-only comparison would incorrectly keep local work as though it were hosted. The draft remains available for an explicit save against the new accepted state.

This authored example explains the discriminator; the named first-hosted-hydration owner test supplies the executable assertion for this repository.

## Recovery and re-entry

When acceptance remains uncertain, preserve the draft and retry identity, then use the existing status/receipt route. When a workspace ends, show that state and let the visitor start another explicitly. If ownership remains unresolved, retain the draft and route the missing acceptance decision to the command owner. An additional spinner can describe waiting; identity checks determine which result may publish.

## Completion

Complete when the current editor, accepted record and feedback agree through the relevant reordering, and the visitor retains one clear recovery action. Re-enter when a persistence mode, editor lifetime or receipt policy changes that relationship. Ordinary fields keep their existing simpler ownership until an independent lifetime requires more structure.
