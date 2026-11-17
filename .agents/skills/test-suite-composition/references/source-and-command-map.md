# Source owners and command selection

Load this map to choose an existing test family, prepare a clone, or place a new test. Current [package scripts](../../../../package.json), [Playwright configuration](../../../../playwright.config.mjs) and [workflows](../../../../.github/workflows) own executable selection. This map explains their receiving jobs; inspect source when a command or owner changes.

## Prepare only what the selected route needs

Read the supported Node line and exact pnpm version from `package.json` and `.mise.toml`, then run `pnpm install --frozen-lockfile`. A package-store hit still receives frozen dependency verification. Node tests use `node:test` and `node:assert/strict`; several TypeScript owner tests transpile their selected modules through the installed TypeScript package. Transpilation exercises behavior and leaves type checking to `npm run typecheck`.

Run `npm run build` before tests that inspect `dist`, import `build/server/example-data.mjs`, use the production server fixture or exercise a browser. The build writes browser and private-server projections. Rebuild when source/configuration affecting either projection changes. Pure source-transpiling tests can run without this build; read the selected file's imports rather than assuming every Node test has the same prerequisite.

Install the locked local browser when needed with `pnpm exec playwright install chromium`; Linux environments may need `pnpm exec playwright install --with-deps chromium`. A compatible existing Chrome/Chromium executable can be selected through `BROWSER_EXECUTABLE`. Record that browser identity rather than describing it as the pinned engine. The Actions smoke route makes this distinction explicit.

## Exact command routes

Commands below run from the repository root. Replace a selected filename or case name only after locating the actual owner. A discovery command establishes selection, not passing application behavior.

| Receiving question | Command | Prerequisite and scope |
| --- | --- | --- |
| Does Source metadata retain its canonical identity and provenance? | `node --test tests/source-session.test.mjs` | Dependencies installed; focused command-owner behavior. |
| Does async Source state preserve retry intent and revision ownership? | `node --test tests/source-workspace.test.mjs` | Dependencies installed; browser service owner with controlled transport. Actual cookie/SQL behavior remains separate. |
| Does one named case execute? | `node --test --test-name-pattern='ambiguous retry' tests/source-workspace.test.mjs` | Inspect executed versus skipped cases; a changed title can leave this selector with no meaningful execution. |
| Which browser cases will run? | `pnpm exec playwright test --list tests/browser/responsive-exploration.spec.mjs` | Installed Playwright; module discovery may execute imports. No browser result is implied. |
| Does selected scene intent survive responsive receivers? | `npm run test:browser -- tests/browser/responsive-exploration.spec.mjs` | Fresh build, compatible browser and free port 3200. |
| Do API/session boundaries agree with built private data? | `node --test tests/graphql.test.mjs tests/workspace-api.test.mjs tests/workspace-session.test.mjs` | Fresh build; tests own synthetic inputs and their transport fixtures. |
| Are the current types and known 3D style carriers valid? | `npm run typecheck` and `npm run check:3d` | Types/configuration and the declared literal-style guard respectively; neither observes the rendered 3D scene. |
| Does the mobile startup graph stay deferred and within budget? | `npm run test:startup` | Fresh production build; emitted manifest/asset graph, not measured network latency. |
| Does the ordinary Node test population pass? | `npm test` | Fresh build and installed dependencies; shell selection is `tests/*.test.mjs`. Optional real-engine cases may skip. |
| Does the ordinary production browser population pass? | `npm run test:browser` | Fresh build and installed browser; `tests/browser/*.spec.mjs` admitted through Playwright. Stored-workspace cases have a separate database opt-in. |
| Do real catalog/workspace operations work on MySQL? | `npm run test:mysql` | Fresh build, MySQL CLI and independently provisioned disposable database; see service contract below. |

The [README verification route](../../../../README.md#verify-a-change) composes types, 3D guard, build, aggregate Node tests and ordinary browser tests for shared changes or release candidates. A particular API or browser claim can still need a focused case that the aggregate lacks.

## Owner-to-test starting points

These are routing examples rather than an exhaustive dependency registry. Follow changed imports and consumers with `rg` before deciding that a focused file covers the full change.

| Behavior owner | Existing evidence and useful extension point |
| --- | --- |
| [Source command preparation](../../../../src/app/services/sourceSession.ts), [async workspace owner](../../../../src/app/services/sourceWorkspace.ts) | [source-session](../../../../tests/source-session.test.mjs), [source-workspace](../../../../tests/source-workspace.test.mjs), [Source operations browser](../../../../tests/browser/source-operations.spec.mjs). Hosted acceptance adds [workspace API](../../../../tests/workspace-api.test.mjs), [PostgreSQL store](../../../../tests/postgres-workspaces.mjs) and [stored browser](../../../../tests/browser/source-workspace.spec.mjs). |
| [Permission kernel](../../../../shared/permission-scope.mjs) and [current scenario](../../../../src/app/services/permissionScenario.tsx) | [permission policy](../../../../tests/permission-policy.test.mjs), [scoped reads](../../../../tests/scoped-reads.test.mjs), [scoped client](../../../../tests/scoped-client.test.mjs) and [scenario browser](../../../../tests/browser/permission-scenario.spec.mjs). A disabled button alone leaves direct command refusal unobserved. |
| [Shared exploration](../../../../src/app/services/exploration/ExplorationProvider.tsx), [guide model](../../../../src/app/components/guide/guideState.ts) and actual scene receivers | [guide state](../../../../tests/guided-exploration.test.mjs), [responsive exploration](../../../../tests/browser/responsive-exploration.spec.mjs), [guided browser](../../../../tests/browser/guided-exploration.spec.mjs). Test actual receiving selection and cancellation, not a second remount-time default. |
| [Plate command owner](../../../../src/app/components/plate/plateCommands.ts), histories and scene motion | [Plate commands](../../../../tests/plate-commands.test.mjs), [history client](../../../../tests/plate-history-client.test.mjs), [scene transition](../../../../tests/scene-transition.test.mjs) and [Plate browser commands](../../../../tests/browser/plate-commands.spec.mjs). |
| Accepted specimen, release, Map, QC, artifact and cohort services under [services](../../../../src/app/services) | Matching `record-commands`, `release-workflows`, `map-operations`, `qc-reviews`, `artifact-workflows` and `cohort-session` Node tests; corresponding named browser files under [tests/browser](../../../../tests/browser). Preserve distinct canonical records and refusal/recovery in fixtures. |
| [Request admission](../../../../server/security/request-admission.mjs), [read API](../../../../server/graphql) and [workspace API](../../../../server/workspaces) | [request-admission](../../../../tests/request-admission.test.mjs), [graphql](../../../../tests/graphql.test.mjs), [workspace-api](../../../../tests/workspace-api.test.mjs), [document-policy](../../../../tests/document-policy.test.mjs). Controlled deferred handlers distinguish returned deadlines from underlying cleanup. |
| Build and ordinary startup under [scripts](../../../../scripts) | [startup-bundle](../../../../tests/startup-bundle.test.mjs), [deployment](../../../../tests/deployment.test.mjs). [server-fixture](../../../../tests/server-fixture.mjs) owns temporary server preparation and teardown. |

Place new ordinary Node cases in `tests/*.test.mjs` and browser cases in `tests/browser/*.spec.mjs` when those existing discovery rules fit. A new file outside those patterns needs an explicit runner owner. Real-engine `mysql-*.mjs` tests deliberately belong to the guarded database composition. Add new engine phases through that owner and verify order, cleanup and reseeding. A generic “run every test file” glob can destroy the fixture another family needs.

For PostgreSQL engine or clone changes, use the [native populations](../../../../docs/postgresql.md#focused-evidence) or [Compose proof](../../../../docs/runbooks/local-postgresql-clone.md#run-the-owned-clone-proof). Those routes own explicit engine/project preparation; ordinary tests retain their independent scope.

## Service and browser lifecycle

The browser configuration runs one worker with zero retries, rejects focused-only tests, and serves the production build on port 3200 with `reuseExistingServer:false`. A busy port is a coordination failure to resolve, not a reason to attach to an unknown build. A separate ignored configuration can supply another port for parallel investigations while retaining the repository-root working directory and matching base URL. Extra browser contexts receive explicit closure; local screenshots/traces remain in ignored `.visual-runs`.

Ordinary browser storage marks the optional guide as already seen. The guide-specific suite intentionally supplies first-arrival storage. A new journey should choose that state explicitly when the opening invitation matters, rather than changing unrelated tests' baseline.

The [database runner](../../../../scripts/prove-database.mjs) requires `DB_HOST`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`; `DB_PORT` defaults to 3306. It accepts only loopback and a database named `sot_*_test` or `sot_*_proof`, sets its own opt-ins and requires a MySQL CLI (`MYSQL_CLIENT` can select one). For an explicitly prepared ignored local file, `node --env-file=.env scripts/prove-database.mjs` loads those settings. Verify independently that the endpoint is disposable; a forwarded hosted connection can still appear as loopback.

The runner orders destructive workspace proof before catalog proof, then initializes both families before workspace HTTP checks. It stops at the first failed phase and leaves initialized tables after success for a separately requested stored-browser journey. The ordinary aggregate and ordinary browser suite do not substitute for that engine result. Hosted data remains outside all test setup.

For a Source editor, reload or uncertain-response UI claim, retain that same disposable server and its exported `DB_*` environment after the proof, then run:

```sh
WORKSPACE_BROWSER_DATABASE=1 npm run test:browser -- tests/browser/source-workspace.spec.mjs
```

The flag admits the three stored-workspace browser journeys; the fresh production build, initialized database and free port 3200 remain prerequisites. Database proof itself runs engine/HTTP cases, not this browser file. Without the explicit opt-in, these journeys skip and leave the stored UI claim unobserved. Release the independently owned database after the final selected check.

## Manual workflow choices

The [automation contract](../../../../docs/development-automation.md) and YAML own the current policy:

- Verify change receives every main PR with a docs/Core selection and committed-tree scan. The inactive main profile requires that unfiltered job; Core also remains an optional manual route.
- Optional dispatches default `run_checks=true`; false skips before runner/services. Verify change always runs. A skipped optional route supplies no behavior evidence.
- Browser defaults to `scene-smoke`: the core, responsive-exploration and guided-exploration files. It uses runner Chrome with a version receipt, falling back to locked Chromium. `all` uses locked Playwright Chromium.
- `include_core=true` runs types, the CSS 3D guard and aggregate Node checks in the same Browser job. For complete ordinary interaction proof select `all` with this option.
- Optional MySQL compatibility proof and publication scan are separate manual choices. PostgreSQL uses the explicit native/Compose routes, with a [manual clone workflow](../../../../.github/workflows/postgresql-proof.yml) for the same container proof. Selected runs share resources only within their job. The shared preparation action caches package bytes and does not reuse another job's VM, build or test result.

When a workflow changes, inspect the proposed revision and dispatch the affected route deliberately. Built-artifact inspection, GitHub publication and actual application deployment remain separate observations and authority boundaries.
