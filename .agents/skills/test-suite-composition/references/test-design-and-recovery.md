# Independent expectations and recoverable checks

Load this reference when a test could pass for the wrong reason, async order matters, or a failure loses useful diagnosis. It supplies concrete decisions; executable cases remain with their current source owners.

## Frame a useful case

Write these six answers before expanding a fixture:

1. **Behavior:** What does the visitor or next consumer rely on?
2. **Owner:** Which command, state store, adapter or renderer creates that state?
3. **Fault:** What plausible implementation would produce a materially different result?
4. **Independent expectation:** Which literal record, accepted invariant or separately reasoned value supplies the answer?
5. **Observation:** What assertion distinguishes the fault at the smallest adequate layer?
6. **Recovery:** Which accepted record, draft or resource must remain after refusal or interruption?

If the result remains the same under the proposed fault, revise the fixture or observation. A test need not explore every arithmetic permutation: a representative case that distinguishes the wrong owner, direction or denominator can be stronger than many implementation-shaped assertions.

## Examples grounded in this repository

These examples describe test design. The linked executable cases carry their own observed results.

### An ambiguous save retains its intent

The [Source workspace tests](../../../../tests/source-workspace.test.mjs) inject a controlled transport and ID factory. Distinguish a lost response after acceptance from a definite refusal. Capture the dispatched ID, expected revision and metadata, then retry the unchanged submission. Assert the repeated command identity and retained draft/accepted projection. A helper that generates a new expected ID on both sides would hide the fault.

Keep the engine's [receipt proof](../../../../tests/mysql-workspaces.mjs) separate: it verifies that an exact retry returns its recorded result without accepting another changed event. A later accepted revision may exceed the replayed receipt; the client must retain the newer projection. The pure service case establishes ordering logic, while the stored browser and real-engine routes establish their receiving transport and persistence.

### Responsive receivers retain the chosen record

The [responsive exploration journey](../../../../tests/browser/responsive-exploration.spec.mjs) selects a named well/result and history options, changes viewport, and reads them in the receiving layout before returning. Use distinct choices that differ from defaults. Assert the receiving selected identity, mode and options, rather than clicking them again after resize; repeating the selection would repair the fault inside the test. A component-only test cannot establish the actual breakpoint/remount path.

### Direct commands preserve scope and accepted state

For a permission change, invoke the actual owner using an admitted record, then a distinct denied or stale input. Assert a typed refusal, unchanged accepted data and any draft recovery that belongs at that layer. Readable parent data does not imply every nested record is readable. Separate actor authorization from the inspected person and cover a second record when cross-record leakage is plausible. A disabled button is useful UI evidence and leaves direct command enforcement to its owner tests.

### A deadline ends the response before work ends

The [request-admission tests](../../../../tests/request-admission.test.mjs) hold a handler with a deferred promise, fill capacity, observe the refusal and release the underlying work. An assertion made only after the handler settles cannot distinguish a slot released too early. Register a cleanup release before awaiting the operation so an earlier assertion failure still permits teardown. Inspect the refusal's stable status/code and the next admitted request, while keeping arbitrary diagnostic text out of the oracle.

### An animation test observes motion rather than machine speed

The [Corridor camera journey](../../../../tests/browser/corridor-camera.spec.mjs) uses a controlled browser clock and reads intermediate/final transforms. Preserve its initial transform, motion phase, settlement and manual cancellation assertions. A controlled clock can establish the transition contract across slow runners. It does not establish frames per second or perceived smoothness; those receive real-time inspection with the actual device/runner. Increase a timeout only after identifying the delayed owner, rather than replacing a failing motion assertion with a final-state-only check.

## A fixture lifecycle that survives failure

Keep fixture data minimal and recognizable. Choose separate identities where confusion matters, bind a clock when time changes the expected value, and reset mutable state per case. A synthetic fixture avoids touching a real laboratory or hosted account. Prefer dependency injection already present in the command owner over global monkey-patching.

Register `t.after` cleanup before creating the next server, directory, pending operation or connection. A resource reference may remain absent after partial setup; its cleanup should still be safe. Await process exit and release owned handles before removing fixture storage. The [server fixture](../../../../tests/server-fixture.mjs) demonstrates early cleanup registration and private fixture-server ownership. Browser tests should close additional contexts and release intercepted/deferred requests in a `finally` block or owned teardown.

Reuse fixture mechanics only when lifecycle and error behavior agree. Cases retain their own source-specific assertions. A large helper that silently normalizes expected records can erase the distinction a regression needs. Conversely, duplicated fixture startup that leaks on failure is a useful candidate for consolidation.

## Interpret the result before rerunning

| Observation | What it establishes | Next action |
| --- | --- | --- |
| Named assertions passed on the selected revision | The exercised path and fixture satisfy those expectations. | Expand only for changed dependencies, unresolved uncertainty or a required receiver. |
| Discovery lists the intended cases | Selection and module loading succeeded. | Run them with required preparation before claiming behavior. |
| Selector matches zero cases or every relevant case skips | The intended claim remains unobserved. | Repair the selector or admit the prerequisite; keep the incomplete result visible. |
| Dependency/browser/build prerequisite is absent | The check could not reach its intended observation. | Prepare that owner and rerun the same selected route. |
| Assertion differs from the accepted behavior | A product or test-contract discrepancy exists. | Inspect actual state and the independent oracle; repair the supported owner. |
| Timing varies while functional assertions pass | Timing remains an environment-specific observation. | Compare phases and population before changing worker count, caching or budgets. |
| A late error arrives after an apparent success | Completion was observed before all owned work settled. | Await final telemetry/cleanup and publish the complete standing. |
| A job is cancelled | Only already-completed observations retain their scope. | Confirm teardown or dispose of the isolated environment, then resume the missing route. |

Retain the original meaningful failure while repairing its cause. Changing fixtures is appropriate when source authority proves the prior fixture stale. Label that as an oracle repair and explain the behavior preserved. A retry that happens to pass leaves intermittent behavior for investigation; retries are not a substitute for defining readiness or resource ownership.

## Add or move a test without widening the harness unnecessarily

Extend the existing owner file when it keeps the behavior discoverable. Add a named file when it gives a distinct source owner or lifecycle a clearer home. Use parameterization for rows that express real boundaries; retain descriptive case names and independent expected values. When moving a case or sharing setup, compare case identities, fixtures, skip conditions and failure standing before and after. Counts alone cannot prove equivalent coverage.

A new runner or dependency needs a capability the current Node/Playwright pair cannot reasonably supply, plus an owner for configuration, installation, cleanup and delivery cost. A new command should state its prerequisites and membership in the nearest README or conditional command map. A global registry is optional; direct commands are a complete composition when they remain easy to select.

The final result belongs in the existing PR or Issue: selected source/commands, normalized pass/fail/skip standing, the behavior established, limits and the next owner when needed. Keep credentials, raw logs, browser state and protected host details with their authorized local or service owner. This result can support independent review; it does not grant merge or hosting authority.
