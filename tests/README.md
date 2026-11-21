# Choose a useful check

Select a check for the behavior being changed. The goal is a discriminating observation with a known expected result, not a large count of passing assertions. [The local testing skill](../.agents/skills/test-suite-composition/SKILL.md) explains independent expectations, plausible faults and bounded fixtures; [the selective-check runbook](../docs/runbooks/selective-check-delivery.md) orders their execution.

## Fast source feedback

After installing the pinned dependencies, `npm run test:mobile` exercises Corridor gesture ownership without a browser or build. Other focused source tests use Node's test runner, for example:

```sh
node --test tests/plate-records.test.mjs
```

Read the selected test's setup before substituting another file. Some tests load emitted server/browser outputs and require a build. Use the shared source contract for an expected result; a test that merely repeats the implementation cannot distinguish a meaningful regression.

## Build-dependent and receiving checks

| Changed owner | Useful check | Prerequisite / scope |
| --- | --- | --- |
| Shared types or literal CSS 3D carrier | `npm run typecheck`; `npm run check:3d` | Installed dependencies; the 3D guard observes known literal styles |
| Read API or HTTP serving | `npm run test:graphql`; `npm run test:deployment` | `npm run build`; actual local server tests |
| Entry points or dependency loading | `npm run test:startup` | Fresh production build; emitted files and initial-JavaScript budget |
| Named state/command owner | Matching `*.test.mjs` | Read its setup; add a case for the consequential acceptance/refusal/recovery fault |
| Visible action or responsive state | Matching `tests/browser/*.spec.mjs` | Fresh build, compatible browser and free port 3200 |
| MySQL schema/transaction owner | `npm run test:mysql` | Fresh build, MySQL CLI and an isolated local database admitted by the runner |
| PostgreSQL schema/transaction owner | [PostgreSQL proof populations](../docs/postgresql.md#focused-evidence) | Fresh build and invocation-owned loopback databases with ordinary roles |
| Clone lifecycle or container delivery | [Owned Compose proof](../docs/runbooks/local-postgresql-clone.md#run-the-owned-clone-proof) | Explicit Docker context; two temporary projects, startup/restart/restore/reset observations |
| Shared dependency or release candidate | Complete ordinary route below | Types, guard, build, Node/API and ordinary browser evidence |

```sh
npm run typecheck
npm run check:3d
npm run build
npm test
pnpm exec playwright install chromium
npm run test:browser
```

`npm test` runs the top-level `*.test.mjs` population, including startup and HTTP checks. Real MySQL and PostgreSQL tests are separate selected proofs. After building and installing Chromium, a focused browser example is:

```sh
npm run test:browser -- tests/browser/responsive-exploration.spec.mjs
```

[playwright.config.mjs](../playwright.config.mjs) owns the production test server and cleanup. It fails on an occupied port instead of reusing an unknown build. Failure captures stay in ignored `.visual-runs/`; examine them locally before sharing a sanitized result. A compatible installed browser may be supplied with `BROWSER_EXECUTABLE`; record its actual version rather than implying it was Playwright's locked revision.

## Optional WebKit scenes

For a focused cross-engine observation, build once and run:

```sh
pnpm exec playwright install webkit
npm run test:browser:webkit
```

[The WebKit configuration](../playwright.webkit.config.mjs) selects existing Corridor controls/presets/Reset, Plate history/record scrolling, mobile history and responsive-return journeys. It shares the ordinary production server, port ownership, one worker and cleanup, while clearing the Chromium-only executable override. Default Chromium discovery remains unchanged. The manual Browser workflow offers `suite=webkit-scenes` and records the selected engine, source revision and result.

Playwright WebKit establishes engine behavior with desktop/touch emulation. A Safari/iOS device check separately establishes actual device input, browser chrome and hardware behavior. The CDP touch-capture probe stays with Chromium. Keep failures and captures local, then route a reproducible product failure to its named owner. [Playwright projects](https://playwright.dev/docs/test-projects) and [browser installation](https://playwright.dev/docs/browsers) describe these engine boundaries.

## Database and CI selection

The guarded `test:mysql` runner accepts only a local disposable database with the declared test/proof naming pattern, sequences destructive fixture setup and leaves its final installed fixture for optional browser proof. It never supplies evidence for a hosted database. [Automation](../docs/development-automation.md) documents required settings, manual Browser/PostgreSQL clone/MySQL compatibility/Publication scan choices and optional shared setup. A skipped check records a selection; it establishes no behavior result.

Every pull request targeting `main`, including drafts and retargeting edits, receives **Verify change**. That workflow selects the documentation or Core population from the changed owners and scans the complete committed tree. The separate **Core checks** workflow is manual-only; Browser, database and publication checks also retain deliberate dispatch. Optional checks expose `run_checks=false` to skip their allocation, while Verify change always executes its selected route.

New clones carry workflow files and disabled [ruleset templates](../.github/rulesets/README.md). Their owners configure repository settings and required results separately. In this receiving repository, the installed review contract names Verify change; template enforcement values describe the reusable files rather than the live account. [Automation](../docs/development-automation.md) and the executable workflow YAML own detailed triggers, populations and concurrency.

For a visual change, also inspect the affected scene, density, focus and settled animation. Browser assertions support those observations but cannot replace a receiving-device or host check. Return the exact revision, checks run, their result and the next useful observation in the existing PR.

Before publishing a snapshot or delivery artifact, use the [publication-scan runbook](../docs/runbooks/publication-scan.md) for its exact source/artifact scope and detector canary. That check answers a different question from functional tests; its sanitized result carries the coverage boundary into review.

[Documentation](../docs/README.md) · [Repository](../README.md)
