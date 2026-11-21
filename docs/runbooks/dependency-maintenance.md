---
title: Dependency maintenance
version: 0.3.0
status: working
audience: [maintainers, coding-agents]
source_band: public_possible
task_type: collaboration_runbook
---

# Dependency maintenance

Update a named dependency family while preserving the visitor experience, mobile startup boundaries and ordinary Node/PostgreSQL delivery. Completion is an independently reviewed update whose manifest, lockfile and receiving checks agree.

## Establish the reason and receiving owner

Start with an active maintenance request, advisory or concrete compatibility need. Read [package.json](../../package.json), [pnpm-lock.yaml](../../pnpm-lock.yaml), the README's [dependency decisions](../../README.md#dependencies-and-continuation) and the dependency's actual consumers. Confirm the branch, current commit and worktree; preserve unrelated edits through the [focused change route](focused-change.md).

Classify the dependency as browser runtime, server runtime, hosting build tool or development check using [dependency ownership](../deployment.md#dependency-ownership). Browser libraries enter compiled assets through the build installation; the production-only Node package set retains its actual runtime and setup imports. Follow the exact package/version's official release notes and advisory when selecting a target. Record the affected path and benefit; a registry advisory alone does not establish reachability in this application. An unavailable registry leaves the advisory observation unverified, while local source/lockfile inspection can continue.

## Update one coherent family

1. **Choose:** Keep related compatibility owners together. React and its types must agree; Vite's direct version and pnpm override must agree; Playwright and its installed browser revision must agree. Server-only GraphQL/MySQL machinery belongs outside the browser graph. A stack replacement needs its own receiving decision rather than being bundled into routine version maintenance.
2. **Change:** Use the repository's declared pnpm version to update the selected manifest entries and regenerate the lockfile. Inspect the resulting diff for unrelated upgrades, install hooks and newly introduced packages. Reinstall with `pnpm install --frozen-lockfile --prod=false` to establish manifest/lockfile consistency. Preserve the reviewed package classifications while updating the selected family; the Docker build and native build each consume the frozen graph.
3. **Assess:** Run `pnpm audit --prod --json` for the locked production graph. When development tooling changes, also inspect `pnpm audit --json`. Keep raw diagnostic output local and summarize affected packages, severity, reachability and action in the PR. An audit finding earns a bounded repair, explicit remaining Issue or documented applicability decision; automatic force upgrades are not a substitute for that decision.
4. **Verify:** Follow the README's [complete local route](../../README.md#verify-a-change), or manually select Browser checks with `run_checks=true`, `suite=all` and `include_core=true`. The combined Action installs and builds once before core and ordinary browser checks. Application packaging follows the separately authorized deployment route. For a Playwright update, use its matching Chromium revision; the default runner-Chrome `scene-smoke` route answers a narrower question. Add a focused receiving journey when the normal suite leaves a consequential behavior unobserved.

Use the existing startup check to detect Desktop or unopened Plate code entering the initial mobile bundle. Inspect a settled affected view when a rendering, animation, typography or UI dependency changes. Driver/schema changes select the [PostgreSQL proof](../postgresql.md#focused-evidence) and [clone proof](local-postgresql-clone.md#run-the-owned-clone-proof) where their boundaries change. Retained MySQL compatibility uses `npm run test:mysql` or its manually selected isolated [workflow](../../.github/workflows/database-proof.yml). That owner sequences engine checks and reseeding; the [workspace](../workspace-storage.md) and [catalog](../persistent-data.md) contracts retain the details. A routine dependency check never points those tests at the shared hosted database. Workflow/shared-setup updates earn a deliberate run of each affected route at the proposed revision; they no longer trigger all expensive jobs automatically. [Automation](../development-automation.md) owns run/skip choices and cache boundaries.

## Review, recover and deliver

Independent review compares the exact changed versions, source adaptations and evidence against the reason for the update. Keep major migrations and newly discovered larger gaps separately legible through meaningful Issue labels and milestones. If a candidate breaks receiving behavior, restore the prior manifest and lockfile together or retain the candidate on its branch while repairing the named incompatibility. Preserve unrelated work during either recovery.

The PR handback names the updated family, reason, direct/transitive scope, normalized advisory result with date, checks and their limits, plus any unresolved finding. Current authorization controls merge and release. Use [Node deployment](../deployment.md) for a requested release. Image/source identity and actual host behavior retain their respective observations.

These steps establish a bounded maintenance result. A later advisory, broken receiving behavior or changed hosting contract reopens the relevant owner rather than treating a prior clean audit as permanent assurance.
