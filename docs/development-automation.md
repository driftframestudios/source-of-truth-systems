# Development automation

Select the smallest check that establishes the intended behavior. Verify change receives every main PR with its fitting docs or Core route. Browser, real database and publication inspections remain deliberate choices. [Runbooks](runbooks/README.md) connect those results to independent review and handback.

## Select a check

Optional check workflows expose `run_checks`, defaulting to `true`; Verify change always executes its selected route. Select `false` to skip a check's whole job before runner and service allocation. A skip records selection, while behavior remains unobserved. Documentation preflight always executes its selected build; its separate activation workflow uses `activate_deployment`, defaulting to `false`.

| Action | Trigger and selection | Result and boundary |
| --- | --- | --- |
| [Verify change](../.github/workflows/verify-change.yml) | Every main PR, including drafts and retargeting edits. Manual execution always selects Core. | Selected docs/Core checks plus complete committed-tree scanning, with a strict final outcome receiver under the [protected review contract](../.github/rulesets/README.md). |
| [Core checks](../.github/workflows/core-checks.yml) | Optional manual dispatch. | Frozen installation, types, 3D guard, build and ordinary unit/API/startup checks. Real database tests retain their explicit opt-ins. |
| [Browser checks](../.github/workflows/browser-checks.yml) | Manual `scene-smoke` or `all`; optional `include_core`. | Smoke uses runner Chrome when present; all uses locked Playwright Chromium. Selected production-build journeys, with optional Core sharing one install/build. Stored-workspace cases need their separate disposable database setup. |
| [PostgreSQL clone proof](../.github/workflows/postgresql-proof.yml) | Manual only, for storage/clone changes or a release receiver. | Two temporary PostgreSQL projects on runner-owned Docker; stored reads, isolated edits, restart, backup/restore, reset and outage recovery. |
| [Optional MySQL compatibility proof](../.github/workflows/database-proof.yml) | Manual only for a change to the retained adapter. | Ephemeral MySQL 8.4 catalog/import, workspace transactions and HTTP behavior. This is compatibility evidence, not the public PostgreSQL deployment route. |
| [Publication scan](../.github/workflows/publication-scan.yml) | Manual source/history/release selection; Verify change owns automatic main-PR scanning. | Pinned detector, fresh canary and sanitized identity/result for selected source or built artifacts. Metadata, rights and visibility retain their own receivers. |
| [Documentation preflight](../.github/workflows/documentation-preflight.yml) | Manual, from main, for exact accepted app/docs revisions and an immutable documentation tag. | One foundation build, checked routes and file manifest, fresh-canary artifact scan and a retained release receipt. |
| [Activate documentation](../.github/workflows/documentation-deploy.yml) | Manual, from main; explicit activation defaults off. | Verifies the reviewed preflight artifact and deploys those same files through the main-only Pages environment. |

For a shared dependency or release candidate, select Browser `suite=all` and `include_core=true`. These checks share installation and build inside that job. Select actual PostgreSQL proof separately through the [native populations](postgresql.md#focused-evidence) or the [two-clone Compose proof](runbooks/local-postgresql-clone.md#run-the-owned-clone-proof). The manual PostgreSQL workflow invokes that same Compose proof on runner-owned Docker; it generates and cleans up its own project identities.

Manual Actions use the selected branch/tag; compare the run commit with the reviewed revision. Documentation release Actions additionally require the protected main receiver and exact accepted source coordinates. Automatic PR checks use GitHub's proposed merge revision. New source earns fresh evidence for affected behavior. Required Verify change has no PR path filter; it selects its observation inside the job. The active docs-branch check uses pinned main tooling. The receiving repository's Pages source is Actions, with explicit [tagged artifact activation](runbooks/tagged-documentation-release.md); copying workflow files alone installs no account settings.

## Workflow and account ownership

Workflow YAML owns triggers, selected populations and token permissions. This guide routes readers to those executable owners; [tests](../tests/README.md) and [runbooks](runbooks/README.md) select the evidence for a change. The [ruleset guide](../.github/rulesets/README.md) owns the distinction between reusable disabled templates and the receiving repository’s installed review contract. Copying templates prepares a future clone; its owner separately configures and verifies account protections. A fresh account readback establishes current settings whenever a collaboration needs to change or audit them.

## Preparation and execution

The shared [prepare action](../.github/actions/prepare/action.yml) reads Node/pnpm from the package, restores the lockfile-keyed package store and performs a frozen installation. Separate jobs receive separate environments. Selected Browser steps reuse one installation/build. Package caches provide dependency bytes, not previously accepted build or test results.

Scene smoke records runner Chrome's version, or installs locked Chromium when Chrome is absent. The full suite uses Playwright's matched browser and Linux dependencies. One worker, zero retries and an owned production server on port 3200 keep lifecycle clear. Desktop preset/Reset motion-phase checks use a controlled Playwright clock and actual DOM transforms; perceived smoothness retains a separate real-time observation.

PostgreSQL checks require an independently provisioned disposable loopback database and explicit `POSTGRES_TEST=1`; use separate invocation-owned databases for destructive catalog/workspace populations. Compose proof owns temporary projects and exact-project cleanup. The optional [MySQL runner](../scripts/prove-database.mjs) requires disposable `sot_*_test` or `sot_*_proof` settings, a fresh build and MySQL CLI, then sets child opt-ins and sequences destructive storage, initialization and HTTP checks. Run it with `npm run test:mysql`. A loopback address alone cannot establish that a tunnel leads to disposable data; verify ownership before either engine route.

## Recovery and delivery

A newer selected check cancels older work in its workflow/trigger group. A skip dispatch has a separate concurrency group and preserves an active check. Documentation preflights retain their own run identities; Pages activations serialize without cancelling an in-progress deployment. A failed phase keeps its result visible; repair the named owner before rerunning. Registry and runner outages remain incomplete observations. Raw browser traces, screenshots and scanner reports stay with private/local diagnostic owners.

Publish only after the intended revision has its fitting checks, independent review and authorization. [Deployment](deployment.md) supplies the ordinary Node/container boundary; [local operations](runbooks/local-postgresql-clone.md) owns trusted backups and confirmed reset. Application rollback and database recovery are separate actions. Check success preserves the existing publication; explicit Pages activation deploys the selected static artifact. Repository visibility remains a separate owner action.

Check and build jobs use read-only repository tokens and unprivileged PR execution. The isolated Pages deployment job holds `pages: write` and `id-token: write` under its main-only environment. External actions are pinned; hosted database credentials stay outside these routes. The MySQL service password is a disposable fixture. Inputs reach bounded environment/action parameters without shell evaluation. Before updating an action, verify its release commit and update the SHA/comment together. A changed workflow earns an explicit exercise of its affected route. Compare preparation/build/execution cost before adding cache or parallel-job machinery.

[GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use), [path-filter behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpull_requestpull_request_targetpathspaths-ignore), [runner environments](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners), and [Playwright CI preparation](https://playwright.dev/docs/ci#caching-browsers) ground the current controls. Actual runs establish results for their named source; this policy supplies no measured performance claim.
