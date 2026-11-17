# Contributing

Help someone understand a workflow, preserve a useful interaction, or make the code easier to extend. A small, clear change is welcome. Start with [the example](docs/getting-started.md), then read the nearest source README and the contract for the behavior you intend to change.

## Agree on the outcome

Use this repository's Issues tab for a reproducible bug or an improvement proposal. Describe the person using the feature, their intended action, what happens now and the useful result. For a larger feature or dependency change, discuss the outcome before implementing it so the maintainer can identify the fitting scope. Security-sensitive details belong in the [security reporting route](SECURITY.md).

Vikrant Varun Kudesia maintains this project for Driftframe Studios, LLC. Public issues and PRs are active receiving records. The maintainer may coordinate implementation in a separate working repository, then returns the public decision, relevant checks and resulting change here. Contributors can understand and review a change entirely through public source and discussion. When accepted work is carried between repositories, its Git authorship and agreed co-author credit travel with it; later releases retain ordinary public history.

## Make a focused change

1. Create a branch from current `main`; keep unrelated changes separate.
2. Follow the owner routes in [application](src/app/README.md), [server](server/README.md), [shared contracts](shared/README.md) and [tests](tests/README.md). Preserve the current visual language, mobile Corridor/Plate behavior and draft recovery unless the agreed task changes them.
3. Add or adjust a test when it distinguishes a consequential plausible fault. Use the smallest fitting check, then expand for shared dependencies or release boundaries. Format only changed files with `npm run format -- path/to/file.tsx`.
4. Update the existing documentation owner when behavior changes. Keep examples synthetic and publish only sanitized reproduction steps; credentials, patient records, cookies and raw private traces stay outside issues, source and test fixtures.
5. Open a PR explaining the problem, resulting behavior, checks actually run and any remaining observation. For visual changes, include a reviewed, synthetic-data screenshot or describe the affected viewport and interaction. Keep screenshots free of account details.

Independent technical review receives the proposed revision before merge. This solo-maintainer project can record an independent reviewer or coding-agent review in the PR; it does not require a second account's approving-review badge. The maintainer owns acceptance and repository settings. A passing check supports the behavior it exercised; it does not authorize publication or database setup.

## Tests, tools and rights

The [selective check runbook](docs/runbooks/selective-check-delivery.md) explains focused checks, optional browser/SQL proof and release evidence. Copied workflows remain subject to each repository's Actions settings; [automation](docs/development-automation.md) describes the current selection controls. Keep optional expensive checks deliberate.

AI-assisted contributions use the same source, review and rights expectations as other contributions. Describe relevant generated or adapted material so a reviewer can inspect its origin. Keep applicable upstream notices and the [project license](LICENSE). Submit code and assets you have authority to contribute under those terms; identify material governed by a different license in [ATTRIBUTIONS](ATTRIBUTIONS.md).

Please follow the [conduct policy](CODE_OF_CONDUCT.md). Questions about a setup route can start with [Support](SUPPORT.md).

[Return to the repository](README.md)
