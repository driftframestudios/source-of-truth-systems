# Accepted release records

Requirements and Decisions retain local edits across workspace navigation and responsive changes. Their compact actions remain beside the source rationale. The sidebar and Map counts read the same requirement collection as the requirement list; the mobile exact-record companion reads accepted statuses.

Defer selects an explicit release. Supersede selects another active or target-state requirement, keeps the original wording, and records the replacement ID. Confirm accepts a tentative or revisited decision; Revisit returns a confirmed decision to review. **Restore original** restores that record's bundled status and release, with a new session revision. Supplied source text, rationale and dates remain historical evidence.

`services/releaseWorkflows.ts` owns typed commands, record identity, revisions and transition validation. Each accepted command rechecks `release.manage` through the current permission owner. A stale revision, unsupported release, missing replacement, self-replacement or denied role leaves the accepted record intact. These records are public planning examples; the command does not invent patient geography or clinical authority.

`releaseWorkflowContext.ts` keeps the collection in the existing browser-session owner, initialized only by its receiving module. `ReleaseRecordActions.tsx` projects the controls with the existing outlined-action and theme-token grammar. A reload begins a fresh example session. The release-plan preview shows current requirement statuses and source names within its curated packet; presentation material remains reference evidence; changing a local requirement does not publish a release or replace a source document.

Command checks cover exact-record changes, explicit targets, invalid replacements, stale acceptance, late refusal and recovery. Browser evidence covers filters/counts, navigation, accepted decisions and denied restoration. This replaces the unavailable Requirements and Decisions actions recorded in the earlier workspace audit. Future durable events remain a separate identity and storage decision.
