---
name: test-suite-composition
description: Designs meaningful checks and composes existing suites around a named behavior, its source owners, prerequisites and recovery. Applies when a change needs a new test, a passing test misses a plausible fault, check selection is unclear, or repeated preparation obscures useful feedback.
---

# Test suite composition

## Contract

- **What:** Connect one intended behavior to a discriminating observation, then select the smallest execution route that can establish it.
- **When:** A collaborator adds or repairs tests, changes an adapter or shared dependency, reorganizes suites, or needs to reduce repeated setup while retaining useful evidence.
- **Boundaries:** The accepted behavior and its source owner define the expectation. Current user instructions and repository policy define authority. A selected or passing check establishes only its exercised claim; merge, hosted deployment, identity and clinical use retain their separate owners.
- **Result:** An existing check or focused addition, a discoverable command population, and a concise result that identifies executed behavior, remaining uncertainty and recovery.

## Fit and attention

- **Useful when:** A test can pass through the wrong path; async responses cross accepted-state boundaries; browser behavior depends on layout or event ownership; several commands overlap; or setup dominates feedback time.
- **Poor fit when:** One direct source reading or existing focused check already answers the question. A simple prose edit usually needs source/link review and a diff check. Unsettled product meaning first needs a decision from its owner.
- **Smallest useful dose:** One behavior, one consequential plausible fault, one independent expectation and the existing runner that observes the difference.
- **Foregrounds:** Useful assertions, source ownership, admitted test population, prerequisites, cost, side effects and retained state after failure.
- **May under-attend:** A good source map cannot establish measured performance, physical-device behavior or successful hosting. Those require their actual receivers.
- **Interactions:** [Async draft recovery](../async-draft-recovery/SKILL.md), [scoped records](../scoped-record-boundaries/SKILL.md), [responsive handoff](../responsive-intent-handoff/SKILL.md) and [resource lifetimes](../resource-admission-lifetimes/SKILL.md) supply domain invariants when their triggers fit. [Skill authoring](../declarative-skill-authoring/SKILL.md) owns reusable instruction changes. The [selective-check runbook](../../../docs/runbooks/selective-check-delivery.md) orders an already-understood check and delivery route.
- **Rest or release when:** The named receiver can select, execute, interpret and recover from the route, or a smaller existing observation completes the task.

## Inputs, defaults and output

Read the current request, [README](../../../README.md), affected implementation, nearest contract, [package scripts](../../../package.json), existing tests and relevant runner configuration. Establish the branch, revision and working changes. Preserve unrelated work. Identify whether the result concerns a pure rule, command owner, adapter, browser interaction, database engine or delivered package.

The minimum working input is a sentence connecting the action to its consequence, for example: “An ambiguous Source save retries its original intent, so a lost response does not create a second accepted command.” Add the source owner, smallest representative input, plausible faulty alternative, expected signal and execution prerequisites. If one is unknown, inspect the owner or ask for the missing product decision while continuing independent work. Keep an unavailable environment explicit.

Use Node's existing test runner and Playwright by default. Reuse established fixtures and cleanup mechanics; keep expected domain values visible in the case. Prefer one literal, consequence-bearing fixture over a large generated population. Add a dependency, shared harness or suite registry only when an observed repeated problem warrants that owner.

The output can be a direct observation, an authorized test change, or a selected route through existing checks. Its receiving record names the exact source, command/population, preparation, normalized result, exercised claim, skips or remaining gaps, and next action when one exists. Use the existing PR or Issue instead of creating a parallel evidence ledger.

## Rules

### Rule: The intended behavior gives the test its meaning

State what the correct owner retains, accepts, refuses or reveals. Name a plausible faulty implementation and the observation that distinguishes it. A test title should describe that difference rather than a private function call. A click that returns successfully establishes less than an accepted record that survives navigation and reaches its next consumer.

### Rule: The expectation has an independent basis

Derive expected values from a literal fixture, accepted requirement, separately reasoned invariant or independent calculation. Calling production logic to calculate both actual and expected values verifies only the remaining parity relationship. Add an independent semantic anchor when correctness is the question. Require meaningful record membership before comparing two projections; two empty collections can agree while the visitor's task remains unserved.

### Rule: Observation depth follows the plausible fault

Use a pure check for normalization or transitions, a command-owner check for permission/revision/accepted-state rules, an adapter or HTTP check for transport ownership, and an actual browser for responsive remounts, focus, gestures and rendered state. Database atomicity and SQL execution need the disposable engine route. A source-text assertion fits a declared static contract; it cannot replace behavioral evidence merely because implementation text is easy to match.

### Rule: Fixtures separate states that matter

Choose distinct records, revisions, actors and accepted values when the fault could confuse them. Differentiate absent from zero, denied from unavailable, local from stored, pending from accepted, and a stale completion from a current request. For an async race, control completion order with a deferred operation or owned clock. Fixed sleeps and large random matrices can obscure the cause; use them only when their timing or distribution is itself the question.

### Rule: Shared mechanics preserve independent assertions

Helpers can own serving, temporary files, clock control, browser setup and teardown. Cases own the expected values and consequences. Register cleanup before acquiring the next resource; preserve cleanup after partial initialization, rejection and interruption. Keep shared accepted-state fixtures fresh per case. A helper extraction earns its place when it removes repeated mechanics without hiding which record, refusal or recovery failed.

### Rule: Selection and execution remain distinct

A command plan names intended coverage. Discovery reveals admitted cases and may execute test-module initialization. A runner result establishes which cases passed, failed, skipped or were cancelled. A zero-match selector leaves the claim unobserved. Inspect names and scenarios when migrating commands: equal test counts alone leave membership, fixtures and assertions unresolved.

### Rule: The smallest adequate route runs first

Run the affected owner while editing. Expand when a changed adapter, shared state owner, fixture, dependency or explicit release receiver reaches more families. A runtime-neutral document edit receives document proof. A shared dependency or release candidate receives the complete ordinary route; real SQL and hosted acceptance remain separate choices when required by that change. Optional workflow controls conserve work; they do not turn an omitted required observation into a pass.

### Rule: Preparation reuse binds identity

Reuse an existing installation or build only while its relevant source, lockfile, runtime, configuration and environment remain compatible. Rebuild after source changes that affect `dist` or `build/server`. Package caches supply dependency bytes for verification; they do not supply accepted test results. GitHub's preparation composite shares instructions and package-cache use across jobs, while the Browser job can reuse one install/build across its selected steps. A current runner-Chrome smoke result and locked Playwright Chromium result retain their distinct browser identities.

### Rule: Expensive families have explicit entry and cleanup

Use the [automation contract](../../../docs/development-automation.md) for current defaults. Optional workflows' `run_checks=false` skips the whole job before allocation; Verify change always executes its selected required route. Browser and compatibility-database runs are manual choices; PostgreSQL proof has its explicit local native/Compose routes. A database proof requires an independently provisioned disposable loopback database; the guarded runner owns destructive ordering and reseeding. A loopback address alone cannot establish that a tunnel leads to disposable data. Keep secrets and raw traces with their protected runtime owners.

### Rule: Optimize the measured phase

Separate package preparation, browser/system setup, build, behavior execution and artifact delivery before changing a slow route. Preserve the chosen behavior population and failure standing while adjusting preparation. Use existing runner capability and supported package caching first. Additional images, cache registries or parallel jobs need a demonstrated benefit and a maintenance owner. Record observed timings with source, population and environment; a proposed optimization supplies no measured saving.

### Rule: Results retain their exact standing

Report executed pass, failure, skip with reason, incomplete prerequisite, cancellation and prior evidence reuse distinctly. A required case skipped for absent configuration leaves its selected claim incomplete. Reusing an unchanged earlier observation retains its original source and scope; it is not a new execution. A failed test can expose product, fixture or environment faults. Change an expectation only when its accepted contract supports that correction.

## Operating sequence

1. **Locate:** Read current source, tests, contracts and accepted work. Identify the behavior owner and consequential downstream consumers.
2. **Frame:** Name the intended state, plausible fault, independent expected result and smallest observation layer.
3. **Select:** Find an existing case or add a focused one. Choose exact files/cases and the condition that would expand the route. Use the conditional references below for commands and concrete fixtures.
4. **Prepare:** Verify the declared toolchain, dependencies, current build and required disposable services. Discover browser cases before costly execution when membership is uncertain. Keep cleanup active after partial setup.
5. **Observe:** Run the selected population. When useful and safely isolated, show that a controlled faulty variation changes its signal; restore that variation before delivery. A focused regression can also demonstrate the prior fault directly.
6. **Interpret:** Confirm the intended path actually executed. Inspect failures before rerunning; distinguish test admission, fixture, implementation and external prerequisite outcomes.
7. **Expand when warranted:** Follow changed dependency edges or the release contract. Preserve prior valid evidence, and rerun only what the changed source or remaining uncertainty reopens.
8. **Receive:** Request independent review at the intended commit, report the bounded result in the existing PR, and leave hosting or additional authority with its named receiver.

## Conditional context

- Load [source owners and commands](references/source-and-command-map.md) when selecting a suite, preparing a clone or adding a test that needs to join normal discovery.
- Load [test design and recovery](references/test-design-and-recovery.md) when an oracle, async race, fixture lifecycle, performance assertion or failure meaning needs definition.
- Use the local [writing guide](../declarative-skill-authoring/references/writing-and-evidence.md) for material test guidance and result prose. Desired behavior leads; exact safety, executable and evidence boundaries retain their meaning.

## Recovery and completion

Preserve accepted edits and unrelated work while resolving the smallest failed owner. A missing browser, occupied server port, unavailable registry or missing build receives its own preparation repair. A consequential assertion failure stays visible while the implementation or supported expectation is repaired. Keep a direct dependency-install route when cache restoration fails. A destructive database route that cannot establish disposable ownership stops before execution.

Complete when the receiver can identify the behavior established, the fault distinguished, actual population and standing, environment identity and coverage boundary. A new command must be discoverable through an existing local owner and keep prior required coverage or explain its intentional replacement. Reopen after a missed defect, source-contract change, new material environment or misleading result. A newly authored skill or runbook remains a working method until a fresh receiving exercise supplies separate evidence of usability.

## Provenance

Adapted from the public exemplars' [suite composition](https://github.com/driftframestudios/human-ai-systems-exemplars/blob/main/.agents/skills/test-suite-composition/SKILL.md) and [evidence-bearing test design](https://github.com/driftframestudios/human-ai-systems-exemplars/blob/main/.agents/skills/evidence-bearing-test-design/SKILL.md). This local skill and references contain the complete operative method for an independent clone; upstream guidance informs review rather than silently changing repository obligations.
