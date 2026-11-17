# Comparison decisions

Comparisons lets a visitor accept a displayed resolution, keep a comparison for later review, or reopen a settled item. The two source statements, their authority states and the resolution text remain visible beside the accepted status.

## Interaction and visual contract

| Current status | Available action | Result |
| --- | --- | --- |
| Pending or Conflict | Resolve | Resolved; accepts the displayed resolution |
| Pending or Conflict | Defer | Deferred; retains the proposal for later review |
| Deferred | Resolve | Resolved |
| Resolved or Deferred | Reopen | Pending; returns the item to review |

The summary includes all four statuses and reads the same accepted collection as the cards. Mode filters affect the displayed cards; they leave accepted decisions intact. Section navigation restores the latest decisions. The application session retains accepted decisions through desktop/mobile replacement, alongside specimen and biomarker edits. A full reload starts a fresh example session. The deferred comparison provider keeps its command policy and consumes a lazy session-owned state cell.

The existing paired evidence cards, compact actions, status colors and release identity remain. Header groups wrap at compact laptop widths, and the card list scrolls inside the workspace. Resolved records offer Reopen; Pending, Conflict and Deferred retain a proposed-resolution label. The updated status is an inline live result rather than an extra form or blocking dialog.

## State and command ownership

`services/comparisonSession.ts` owns the ordered ID index, explicit transition table, immutable updates and status summary. An accepted update replaces only its target record; source fixtures and other records retain their identity. Missing IDs, repeated decisions and unavailable transitions preserve the state object.

`comparisonSessionContext.tsx` keeps the collection above desktop section navigation. It exposes records and a `decide` command, while retaining the setter privately. Every command evaluates the current shared write gate at this owner. Refused actions display the existing permission explanation and preserve the accepted record. The pure transition function also requires a permitted result, keeping the effect boundary explicit for later command-policy work. The view uses the same gate for its role and affordance display.

This is a browser-session decision over the provided comparison. It leaves the separate Decision Log, source content and server data under their existing owners. Persistence and wider command enforcement can extend this boundary through the dedicated work items; clicking Resolve does not publish a source change.

## Evidence

`tests/comparison-session.test.mjs` proves target identity, immutable fixtures, retained resolution text, legal reopen/deferral paths, summary agreement and unchanged state on denied or invalid commands. `tests/browser/comparison-actions.spec.mjs` exercises Resolve → filter → Reopen → Defer → section return → Reopen, verifies another record remains Pending, and checks a Production refusal plus compact-width containment. Production Chromium and type checking establish these receiving paths; hosted persistence is outside the browser-session contract.
