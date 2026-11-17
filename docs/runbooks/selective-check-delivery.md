---
title: Select meaningful checks and deliver their result
version: 0.1.0
status: working
audience: [maintainers, coding-agents]
source_band: public_possible
task_type: collaboration_runbook
---

# Select meaningful checks and deliver their result

Give an independently reviewing collaborator a useful result for a bounded change without repeating unaffected work. This route completes when the selected checks, actual execution standing, coverage and next receiver are clear in the existing PR or Issue. A built artifact retains its exact source identity; hosted publication has its own receiving observation.

This is a working runbook until a fresh reader completes its route. [The testing skill](../../.agents/skills/test-suite-composition/SKILL.md) owns test design and selection reasoning; [automation](../development-automation.md) owns current workflow controls; [focused change](focused-change.md) owns the broader implementation/review cycle.

## Enter with a bounded change

- **Source:** Read the current request, relevant Issue, [README](../../README.md), changed owners and existing tests. Confirm `git status --short`, `git branch --show-current` and `git rev-parse HEAD`. Preserve unrelated edits. If the revision or remote state is uncertain, establish it before publishing a result tied to that source.
- **Authority:** The request supplies permission to change tests, run commands, dispatch CI, package or merge. This runbook supplies order. Where an action is outside the grant, prepare its concrete result and hand it to the authorized owner.
- **Behavior:** Name the intended consequence and one plausible fault. If product meaning remains unsettled, return that decision to its owner while source inventory continues.
- **Environment:** Read the declared toolchain and runner prerequisites. An unavailable prerequisite leaves its observation incomplete; use the preparation or manual CI route rather than silently reducing the claim.

## 1. Select the observation — inspect and plan

Use the existing [source/command map](../../.agents/skills/test-suite-composition/references/source-and-command-map.md). Choose a pure-owner test for a transition, API/adapter test for a transport boundary, browser journey for an interaction or remount, and disposable SQL proof for engine behavior. A prose-only edit usually needs local link/source review and `git diff --check`.

State the selected files/cases and what would expand the route. A shared dependency, cross-family state owner or release candidate usually reopens the complete ordinary route. A schema/driver/transaction change adds the database receiver. Hosted acceptance remains a later operator observation.

**Checkpoint:** The plan connects each selected check to a changed owner and intended consequence. If no existing assertion distinguishes the plausible fault, add a focused case using an independent fixture or invariant. Keep its setup/cleanup with existing owners. [Test design and recovery](../../.agents/skills/test-suite-composition/references/test-design-and-recovery.md) supplies concrete examples.

## 2. Prepare the chosen route — local execution or explicit dispatch

For local work, install the declared dependency graph with `pnpm install --frozen-lockfile`. Run the selected pure test directly. Build with `npm run build` before cases that inspect `dist`, import private server output or launch the production browser server. Install the matching browser when needed; keep port 3200 available or coordinate an ignored alternate configuration with an explicit repository-root working directory.

For GitHub Actions, verify the selected branch/tag and use these controls:

| Need | Deliberate selection | Result |
| --- | --- | --- |
| Ordinary code/configuration PR | Core runs automatically when ready and eligible; `CORE_CHECKS_AUTOMATIC=false` pauses auto runs. Manual Core remains available. | Types, CSS 3D guard, build and ordinary unit/API/startup evidence. Known Markdown-only paths are filtered. |
| Quick Corridor/Plate/guide receiving check | Browser `suite=scene-smoke` | Named smoke files on runner Chrome, with version recorded; locked Chromium fallback if unavailable. |
| Broad interaction/dependency proof | Browser `suite=all`, `include_core=true` | Complete ordinary browser population plus Core, sharing one installation/build in the job. |
| PostgreSQL engine/transaction or clone proof | [Native engine populations](../postgresql.md#focused-evidence) or manual [PostgreSQL clone proof](../../.github/workflows/postgresql-proof.yml) | Explicit disposable ownership, initialization and recovery evidence. |
| Retained MySQL compatibility | Optional MySQL compatibility proof | Isolated service and owned destructive sequence; shared databases remain untouched. |
| Intentionally rest a manual route | `run_checks=false` | Whole job skipped before runner/services; no behavior or artifact result. |

All dispatches default `run_checks=true`. Browser smoke and full-suite results retain their different populations. SQL proof stays separately selected. Path-filtered Core can remain Pending when required; maintainers own a compatible required-check policy. See [automation](../development-automation.md) for exact trigger and concurrency rules.

**Checkpoint:** Preparation matches the checked source and selected population. An existing package cache still receives frozen install verification. Separate jobs share setup code/cache, not a VM or accepted build/test result. Reuse within the Browser job retains one source and environment identity.

## 3. Execute and interpret — observe

Run the selected command. For uncertain browser membership, use Playwright's `--list` route first; discovery leaves behavior for execution. Inspect the case names and skips as well as exit status. A controlled async race should finish through its expected owner, not an arbitrary sleep. A visual change earns a settled affected-view inspection at its meaningful viewport; test success alone leaves visual quality open.

For PostgreSQL, select the explicit [native proof populations](../postgresql.md#focused-evidence) against independently owned disposable databases, or use the [Compose proof](local-postgresql-clone.md#run-the-owned-clone-proof). MySQL compatibility uses `npm run test:mysql` with disposable loopback `DB_*`, MySQL CLI and a current build. Its runner owns destructive ordering and reseeding. Keep shared or hosted databases outside those routes, including tunnels that make a remote endpoint appear local.

**Checkpoint:** Record which selected observations executed and which remain incomplete. A required case that skips for missing configuration needs its prerequisite or a named next receiver. Stop a claimed release handback when consequential assertions or required observations remain unresolved.

## 4. Recover proportionately — repair the responsible owner

| Condition | Safe next action |
| --- | --- |
| Missing dependency, browser, build or free port | Preserve source work, restore the named prerequisite and repeat the same focused route. |
| Assertion disagrees with the current accepted contract | Inspect the fixture and implementation; repair the supported owner and keep the original failure meaningful. |
| Later source changes affect an earlier build/result | Rebuild and rerun affected consumers; retain unrelated evidence with its original revision and scope. |
| Interrupted browser/server fixture | Confirm owned handles and child processes were released before reusing the port or temporary directory. |
| SQL proof fails midway | Keep its database disposable and rerun through the guarded runner after repair; its ordering owns reset and initialization. |
| Registry/cache/runner service is unavailable | Use the direct preparation route when available, or report an incomplete prerequisite with the next receiving owner. |

Broaden testing when the failure reveals a shared cause or new dependency edge. Avoid treating repetition alone as assurance: a passing rerun leaves an unexplained intermittent fault open. Compare setup/build/test phases before changing suite size or adding caching infrastructure.

## 5. Receive review and hand back — review and deliver

Ask an independent reviewer to inspect the exact intended commit, changed owners and selected evidence. Provide the plausible fault and coverage boundary so the reviewer can assess whether the observation is useful. Repair material findings and renew affected evidence/review. Current authorization governs merge.

Use one concise PR/Issue result: changed behavior; exact source and command/population; executed pass, failure, skipped or incomplete standing; what it establishes; relevant environment; and the next action if one remains. Raw diagnostics, cookies, browser state and hosting coordinates stay with their protected owner. Test counts can describe population but cannot replace its meaning.

If an artifact is requested, record its digest and reviewed source revision. Follow [Node deployment](../deployment.md) or [local clone operations](local-postgresql-clone.md) for the receiving environment. Preserve a prior reviewed application artifact and its separate database recovery route. Hosted observation completes deployment acceptance independently of local tests.

The route is complete when the reviewer can distinguish checked behavior from held work and can resume the next step without reconstructing the conversation. A fresh-reader exercise can promote this runbook's status; a workflow, source-owner or receiving-contract change reopens the relevant section.
