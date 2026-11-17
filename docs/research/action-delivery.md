# From controls to accepted operations

A visitor can predict what a control changes, see that result beside the selected record and recover through the operation's own inverse or reset. The [workspace assessment](../workspace-audit.md) now records the delivered local effects. This synthesis preserves the workflow decisions and the extension points for later identity, storage and external execution.

**Supersession:** #48, #60 and #71 replace the earlier unavailable-action and view-local-state findings. Scoped grants, GraphQL reads and history caching from #70 are also delivered. The disposable Source workspace decision in #85 now supersedes the open hosted-ownership comparison. Connector execution and verified accounts remain separate receiving goals.

## Options and adopted synthesis

| Approach | Contribution | Receiving choice |
| --- | --- | --- |
| Retire a control without a useful consumer | Reduces false affordances | Unsupported Profile preferences have retired |
| State external availability | Keeps the operation understandable | Publish, external source refresh and remote notification routes retain explicit boundaries |
| Accept a typed browser-session command | Immediate, recoverable exploration with stable record identity | Current synthetic workflow, review and metadata operations |
| Add GraphQL mutations and durable events | Retains changes across devices/deployments | Future identity, scope and recovery decision |
| Invoke an external system | Performs actual refresh, compute or delivery | Separate connector, credentials, cost and operating authority |

The current application combines the first three. Each supported action has a bounded outcome and a state owner. Read-only inspection, camera movement and draft typing keep their own view behavior. Personal appearance/notification choices are presentation preferences rather than record-write authority.

## Accepted interaction path

A view presents the selected record and available action. The feature command resolves the canonical record, evaluates current authority, validates the transition or fields, and commits one accepted update. Versioned editors include the revision they opened. The receiving view reads the shared projection; a denial or conflict retains the accepted record and offers its recovery route.

`services/command.ts` supplies common result/refusal and permission types. Feature owners retain their own discriminated commands, validation and transition tables. The shared policy evaluates permission; it does not replace domain legality. This implementation has no arbitrary-patch mutation or central effect dispatcher. Reopen, resume, restore, discard or save-a-copy belongs to the action family that can interpret it.

## Delivered action families

| Family | Accepted result | Permission and state owner | Boundary preserved |
| --- | --- | --- | --- |
| Specimens / biomarkers | Exact sample/order/review transitions | `recordCommands` / `recordSession`; current canonical consent, geography, resource and capability | Historical stage, dates and clinical examples retain their meaning |
| Comparisons | Resolve, Defer, Reopen and shared counts | `comparisonSession`; current scenario decision | Paired evidence and original proposal stay readable |
| Sources | Save display metadata or restore bundled metadata | `sourceSession`; `workspace.edit`, stable ID and expected revision | Provenance/authority retained; external refresh remains separate |
| Requirements / Decisions | Explicit release deferral, selected replacement, confirmation/revisit and original-record recovery | `releaseWorkflows`; `release.manage` and expected revision | Source wording, rationale and dates remain supplied evidence |
| Map | Legal sample/order/review example transitions retained by node | `mapOperations`; `sample.manage` / `review.approve` with canonical node classification | System nodes stay separate from patient records; work area is context |
| QC | Acknowledge, record hold, request rerun and reopen | `qcReviews`; stage-specific sample, analysis or release capability | Measured metrics, gate status and release hold stay intact; no invented specimen association |
| Artifacts | Check current local references; prepare, save or discard a revision proposal | `artifactWorkflows`; `analysis.run` for checks, `workspace.edit` for proposals | Original file/hash/size/acceptance remain distinct from local metadata work |
| Cohorts | Save, reopen, update, copy and remove named definitions; recompute current matches | `cohortSession` / `cohortRules`; `workspace.edit`, expected revisions and bounded typed trees | Active consent determines eligibility; saved definitions contain no copied patient data |
| Plate files | Restore/repair requests retained by physical-file identity | Plate command/overlay owners; each result keeps its consent scope | Existing demonstration executor/deadline semantics stay explicit |
| Permission experiments | Save validated grants; reset all example grants and the open grid draft | `permissionScenario` / `scenarioGrants`; Save checks `policy.edit`, Reset recovers the public experiment | Current actor/role/environment/audience, inspected person and unrelated accepted work stay intact |
| Profile preferences | Shared appearance and consumed optional informational toasts | Theme owner and `notificationState` / `NotificationProvider` | Required error/refusal feedback remains visible; remote delivery stays external |

[Shared metric comparison](../../src/app/services/specimenQuality.ts) gives specimen displays and cohort matching the same declared at-least/at-most semantics. Target completion requires at least one metric. These typed comparisons interpret the example's declared target; they introduce no new clinical thresholds.

The feature contracts retain exact extension details: [Sources](../source-discovery.md), [release records](../release-workflows.md), [Map/QC](../operational-workflows.md), [Artifacts](../artifact-operations.md), [Cohorts](../cohort-rules.md) and [Profile](../profile-preferences.md). Session resources sit above desktop/mobile projections and initialize when received. Local workflow resources reset on reload; the installed Source workspace hydrates its expiring metadata overrides. Theme choice retains its separate browser-local persistence.

## GraphQL and view gating

GraphQL serves finite synthetic records through approved operation shapes and a server-derived showcase scenario. The shared scope kernel resolves canonical record metadata and filters permitted lists, direct IDs, nested links and counts. Access Grid edits evaluate the acting persona separately from the inspected person. History requests and caches are policy-partitioned; a scope change cancels obsolete work, and denied reads keep their own result rather than exposing an unrestricted fallback. Resetting example grants clears the accepted grant log and derives the seed key for the current selection. Existing scope reconciliation restores its permitted projection, including an already successful cache partition, without clearing records, file recovery or exploration. The log remains bounded to 64 saved cell-change entries: repeated changes count, no-op saves add none, and overflow preserves the accepted scope and draft with reset as recovery.

These controls demonstrate permission behavior. Selectable personas and registered queries do not verify a real visitor's identity. Private records or real multi-user writes require a separate verified-session design and acceptance decision. Readable context and denial explanations remain available where the policy permits them; hiding a write affordance alone never enforces the operation.

Source mutations now expose named operations with record ID, expected version and idempotency key. The server supplies an origin-bound disposable scope and acceptance time, reuses domain validation and simulated policy, and commits the accepted receipt and projection together. Typed refusal/conflict returns preserve the draft. Verified accounts remain a distinct boundary for private records or shared collaboration.

## Database rows follow a durable receiving job

Hosted MySQL serves Plate histories and, after explicit additive setup, isolated Source metadata workspaces. The owner selected [disposable browser workspaces](../visitor-workspaces.md) for that persistence boundary. Other accepted workflow families keep their local owners.

Four separate tables hold workspace ownership/lifetime, bounded Source revisions, accepted receipts/history and migration ownership. A random protected cookie supplies sandbox possession; a normalized origin binds preview and publish. Current scenario actors remain explicitly simulated. Absolute expiry, reset, quotas and exact retries keep the public example scope finite. The canonical baseline, consent, geography and grants retain their existing owners.

The [workspace contract](../visitor-workspaces.md) records transaction, request and recovery boundaries. Its real MySQL checks observe locking, concurrent version/idempotency/quota behavior and rollback. This expiring example history supports inspection; a permanent clinical audit claim requires its own identity, retention and operational evidence.

SQL views may later package a useful read projection. A shared application database login remains distinct from a browser persona, so database view privileges cannot replace application identity and scope. The public path uses PostgreSQL base-table adapters behind the ordinary Node server.

## Evidence and continuation

Owner cases establish exact-record acceptance, refused/stale/malformed commands, domain recovery and original-evidence preservation. Browser journeys establish visible outcomes, fresh accepted-source use, navigation and responsive retention. Scoped API cases add direct/nested-read agreement and cache isolation. Each family uses the applicable subset; the workspace store adds actual-engine rollback and concurrent-version observations for its activated Source writer.

The [permission research](permission-behavior.md) retains the primary-source basis. Compact composition now gives those accepted operations task-specific [working layouts and returns](../workspace-layout.md). [Grant-experiment reset](../permission-scenarios.md) provides local recovery without restarting accepted work. It remains available in Viewer/read-only scenarios because it restores the finite public experiment; ordinary grant saves retain their authorization checks. [Follow a sample](guided-exploration.md) now demonstrates three working scenes with optional playback and manual takeover. AI assistance remains a separate design decision, including any future selected-sample presentation flow.
