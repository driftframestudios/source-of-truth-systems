---
title: Focused change and independent review
version: 0.2.0
status: working
audience: [maintainers, coding-agents]
source_band: public_possible
task_type: collaboration_runbook
---

# Focused change and independent review

Deliver one useful, bounded change with evidence for its actual behavior and independent review of the exact receiving commit. Completion is the authorized PR handback or merge, with any remaining work routed explicitly.

## Enter from current truth

1. **Inspect:** Read the [README](../../README.md), the active Issue or user request, and the affected source and contracts. Confirm `git status --short`, `git branch --show-current` and `git rev-parse HEAD`. Establish the intended PR base from the current request. Preserve unrelated edits; use an isolated worktree when they overlap the task. If remote state is unavailable, identify that observation as unverified before publishing or merging.
2. **Bound:** Name the visitor behavior or source boundary being changed, the existing owner, and the observation that would distinguish success from a plausible failure. The request supplies edit, push and merge authority. A newly discovered larger gap can become a labeled, milestone-linked Issue while the current repair stays focused.
3. **Prepare:** Use the Node and pnpm versions declared in [package.json](../../package.json) and install with `pnpm install --frozen-lockfile`. A tool, registry or environment failure leaves source work intact; resolve that prerequisite before claiming its checks passed.

## Implement and observe

Keep canonical state, current permission checks and accepted-command recovery with their existing owners. Read the README's source map before creating a second state store or bypassing a command. Update the nearest behavioral contract when its accepted behavior changes.

Choose the smallest fitting route from existing checks:

| Change | Observation and command shape | What it establishes |
| --- | --- | --- |
| Prose or runbook | Resolve relative links, compare instructions with current scripts, `git diff --check` | The document has an operable source route; runtime behavior is unchanged. |
| Pure command/state owner | `node --test tests/<affected-owner>.test.mjs` | The named transition and refusal/recovery expectations hold. Add a focused test for a consequential missing case. |
| Visitor layout or interaction | `npm run typecheck`; `npm run build`; `npm run test:browser -- tests/browser/<affected-journey>.spec.mjs` | The current build serves the affected interaction. Inspect a settled affected-view capture at the relevant phone/compact/desktop widths. |
| 3D scene or camera | The affected scene/gesture tests, `npm run check:3d`, and its browser journey | Geometry guards and direct manipulation/preset behavior retain their intended relationship. |
| GraphQL or server boundary | Build first, then the affected API/session/deployment tests | The registered operation and receiving transport agree with the built private data. |
| Shared dependency or release | The complete route in [Verify a change](../../README.md#verify-a-change) | Type, geometry, current builds, unit/API and ordinary browser checks agree for the receiving source. |

Replace placeholder paths with files that exist in [tests](../../tests). Tests that import `build/server` or inspect `dist` require `npm run build` after the relevant source change. Browser checks serve the production build, own port 3200 and refuse to reuse an unrelated server; coordinate the port or use a separate ignored configuration for concurrent work. Keep `.visual-runs` captures and traces local.

In Actions, Verify change receives every main PR with a fitting docs/Core route and full committed-tree scan. Select deeper checks when they can change the decision: Browser scene-smoke for core/responsive/guide behavior, Browser all with include_core=true for a shared dependency or release, and PostgreSQL proof for the engine/clone boundary. These selections preserve their own observed populations. Optional routes offer run_checks=false to skip allocation; Verify change always runs. [Automation](../development-automation.md) owns current controls and the inactive protection profile.

For animation-phase assertions, distinguish motion behavior from renderer throughput. The [desktop preset and Reset journeys](../../tests/browser/corridor-camera.spec.mjs) control browser time and read rendered transforms to observe intermediate motion, bounce, settlement and manual takeover. Real-time visual inspection still owns claims about perceived smoothness; a slow CI frame sample alone does not establish a changed spring curve.

For real MySQL proof, use `npm run test:mysql` with the disposable loopback database admitted by [scripts/prove-database.mjs](../../scripts/prove-database.mjs). That runner owns the destructive test order and reseeding between catalog, workspace and HTTP families. Keep connection settings local; the manually selected [database workflow](../../.github/workflows/database-proof.yml) provides an isolated CI route. The [catalog](../persistent-data.md) and [workspace](../workspace-storage.md) contracts retain the schema and recovery detail. An ordinary suite's skipped database cases establish no engine or hosted result; report them separately and use the proof route when that boundary changes.

Build first and install the MySQL CLI. The runner receives `DB_*` through its environment, accepts only loopback and a database named `sot_*_test` or `sot_*_proof`, and owns its enable flags. For an explicitly prepared ignored local environment file, use `node --env-file=.env scripts/prove-database.mjs`. `MYSQL_CLIENT` can select an installed CLI. The runner leaves the example catalog and workspace tables initialized for separately requested stored-browser checks; it does not perform those browser journeys itself.

## Review, recover and return

- **Review:** Ask an independent reviewer to inspect the exact commit, relevant source and fitting evidence. Give them the behavior, changed owners and any remaining uncertainty. Their return is actionable findings or approval at that commit. Repair findings, rerun affected checks and renew review for material changes.
- **Recover:** When a check fails, distinguish source failure from unavailable prerequisites. Preserve edits and drafts while resolving the smallest owned cause. A failing consequential check, unresolved review finding or missing publication authority stops the corresponding delivery step; return the concrete blocker and next action.
- **Deliver:** Use one PR as the public-safe receiving record: problem and resulting behavior, scope, normalized check results and coverage, review, recovery and any next Issue. Apply meaningful labels and a milestone. Merge only within the current grant and after required review/checks; the runbook supplies no additional authority.
- **Hand back:** State the changed surface, exact PR/commit and `pass`, `friction` or `blocker`, with one next receiver when work remains. Keep credentials, private logs, browser state and protected hosting coordinates with their authorized owner. Use [Node deployment](../deployment.md) and [local clone operations](local-postgresql-clone.md) for an application delivery or recovery request.
