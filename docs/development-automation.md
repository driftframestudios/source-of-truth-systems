# Development automation

Select the smallest check that establishes the intended behavior. Core supplies the current code/configuration PR check. Browser, real database and publication inspections remain deliberate choices. [Runbooks](runbooks/README.md) connect those results to independent review and handback.

## Select a check

Every manual workflow exposes `run_checks`, defaulting to `true`. Select `false` to skip its whole job before runner and service allocation. A skip records selection, while behavior remains unobserved.

| Action | Trigger and selection | Result and boundary |
| --- | --- | --- |
| [Core checks](../.github/workflows/core-checks.yml) | Ready non-draft PRs; known Markdown-only documentation paths are filtered. `CORE_CHECKS_AUTOMATIC=false` pauses automatic runs. Manual dispatch remains available. | Frozen installation, types, 3D guard, build and ordinary unit/API/startup checks. Real database tests retain their explicit opt-ins. |
| [Browser checks](../.github/workflows/browser-checks.yml) | Manual `scene-smoke` or `all`; optional `include_core`. | Smoke uses runner Chrome when present; all uses locked Playwright Chromium. Selected production-build journeys, with optional Core sharing one install/build. Stored-workspace cases need their separate disposable database setup. |
| [PostgreSQL clone proof](../.github/workflows/postgresql-proof.yml) | Manual only, for storage/clone changes or a release receiver. | Two temporary PostgreSQL projects on runner-owned Docker; stored reads, isolated edits, restart, backup/restore, reset and outage recovery. |
| [Optional MySQL compatibility proof](../.github/workflows/database-proof.yml) | Manual only for a change to the retained adapter. | Ephemeral MySQL 8.4 catalog/import, workspace transactions and HTTP behavior. This is compatibility evidence, not the public PostgreSQL deployment route. |
| [Publication scan](../.github/workflows/publication-scan.yml) | Changed committed source on ready PRs; manual source/history/release selection. `PUBLICATION_CHECKS_AUTOMATIC=false` rests the automatic trigger. | Pinned detector, fresh canary and sanitized identity/result for selected source or built artifacts. Metadata, rights and visibility retain their own receivers. |

For a shared dependency or release candidate, select Browser `suite=all` and `include_core=true`. These checks share installation and build inside that job. Select actual PostgreSQL proof separately through the [native populations](postgresql.md#focused-evidence) or the [two-clone Compose proof](runbooks/local-postgresql-clone.md#run-the-owned-clone-proof). The manual PostgreSQL workflow invokes that same Compose proof on runner-owned Docker; it generates and cleans up its own project identities.

Manual Actions use the selected branch/tag; compare the run commit with the reviewed revision. Automatic PR checks use GitHub's proposed merge revision. New source earns fresh evidence for affected behavior. Core excludes known README/AGENTS/Markdown paths; a required path-filtered check can stay Pending on a documentation-only PR. Maintainers own a required-check policy that accommodates that distinction. These files install no repository policy or deployment settings.

## Preparation and execution

The shared [prepare action](../.github/actions/prepare/action.yml) reads Node/pnpm from the package, restores the lockfile-keyed package store and performs a frozen installation. Separate jobs receive separate environments. Selected Browser steps reuse one installation/build. Package caches provide dependency bytes, not previously accepted build or test results.

Scene smoke records runner Chrome's version, or installs locked Chromium when Chrome is absent. The full suite uses Playwright's matched browser and Linux dependencies. One worker, zero retries and an owned production server on port 3200 keep lifecycle clear. Desktop preset/Reset motion-phase checks use a controlled Playwright clock and actual DOM transforms; perceived smoothness retains a separate real-time observation.

PostgreSQL checks require an independently provisioned disposable loopback database and explicit `POSTGRES_TEST=1`; use separate invocation-owned databases for destructive catalog/workspace populations. Compose proof owns temporary projects and exact-project cleanup. The optional [MySQL runner](../scripts/prove-database.mjs) requires disposable `sot_*_test` or `sot_*_proof` settings, a fresh build and MySQL CLI, then sets child opt-ins and sequences destructive storage, initialization and HTTP checks. Run it with `npm run test:mysql`. A loopback address alone cannot establish that a tunnel leads to disposable data; verify ownership before either engine route.

## Recovery and delivery

A newer selected run cancels older work in the same workflow/trigger group. A skip dispatch has a separate concurrency group and preserves an active check. A failed phase keeps its result visible; repair the named owner before rerunning. Registry and runner outages remain incomplete observations. Raw browser traces, screenshots and scanner reports stay with private/local diagnostic owners.

Publish only after the intended revision has its fitting checks, independent review and authorization. [Deployment](deployment.md) supplies the ordinary Node/container boundary; [local operations](runbooks/local-postgresql-clone.md) owns trusted backups and confirmed reset. Application rollback and database recovery are separate actions. Workflow success does not change repository visibility or publish a service.

Jobs use read-only repository tokens, unprivileged PR execution, pinned external actions and no hosted credentials. The MySQL service password is a disposable fixture. Inputs reach bounded environment/action parameters without shell evaluation. Before updating an action, verify its release commit and update the SHA/comment together. A changed workflow earns an explicit exercise of its affected route. Compare preparation/build/execution cost before adding cache or parallel-job machinery.

[GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use), [path-filter behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpull_requestpull_request_targetpathspaths-ignore), [runner environments](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners), and [Playwright CI preparation](https://playwright.dev/docs/ci#caching-browsers) ground the current controls. Actual runs establish results for their named source; this policy supplies no measured performance claim.
