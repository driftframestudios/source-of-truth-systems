# Map workflows and quality reviews

Map and Quality Control retain accepted actions for the current browser session. Section navigation and desktop/mobile layout changes preserve that state; reloading restores the example baseline. Each command resolves its own record and rechecks the current permission scenario before accepting a change.

## Map

The relationship graph contains systems and workflow examples. Selecting a node exposes its available sample, order or review actions through the same legal transitions used by specimen records. Held orders can resume or cancel; reviews can request changes and resubmit; fulfilled and cancelled orders stay terminal. The work-area label describes the node's context.

`mapOperations.ts` owns accepted node state and action selection. Its session resource initializes on first use. Permissions use the node's canonical classification and the corresponding `sample.manage` or `review.approve` capability. The graph's system nodes have no canonical patient/resource geography; their local workflow examples remain separate from specimen records and clinical release.

## Quality Control

Each quality gate has a measured outcome and a separate recorded response. Visitors can acknowledge a passing gate, retain a warning/failure hold, or request a rerun. **Reopen review** restores the response choices. The recorded response updates the gate card and review count immediately.

`qcReviews.ts` owns those responses. Wet-lab gates require `sample.manage`; sequencing and secondary analysis require `analysis.run`; sign-out requires `release.manage`. A response leaves the measured metrics, gate status and blocking flag intact. A rerun request records intent in this browser session; executing laboratory work or releasing a run would require a separately authorized backend workflow.

## Evidence and recovery

`tests/map-operations.test.mjs` observes legal branching, exact-node updates, terminal states and stale-authority refusal. `tests/qc-reviews.test.mjs` observes exact-gate responses, reopen recovery and preserved measured failures. Both exercise the actual permission policy, including role/environment changes after an affordance was shown.

The matching browser specifications exercise visible outcomes, section-navigation retention and a later Viewer refusal in production Chromium. Existing available-action and workspace-scroll checks cover surrounding controls and reachability. Map and QC retain their existing layout, palette and graph/card composition. A denied action explains the current permission requirement while retaining the accepted state.
