# Receive reviewed changes

The receiving repository has activated the reviewed main/docs and release-tag rules and uses Actions-based Pages. [`main.json`](main.json), [`docs.json`](docs.json), [tag creation](tag-creation.json) and [tag retention](tag-immutability.json) retain `disabled` enforcement as reusable import templates. Versioning or copying those files changes no GitHub setting; a new receiver activates them after observing its own checks and account capabilities.

Both profiles require a pull request, resolved conversations and current-merge checks; they block branch deletion and force updates. They have no standing bypass and require zero GitHub approving reviews for the solo owner. Independent technical review remains recorded in the PR. [CODEOWNERS](../CODEOWNERS) routes review to the owner without imposing a second-person approval that the repository cannot supply.

## Application source

**Verify change** runs for every PR to `main`, including drafts and retargeting edits. Documentation-only changes receive their documentation build/contracts; application, mixed and unknown owners receive Core. Both routes include the complete committed-tree publication scan. The final result requires every selected step to pass at the same revision. Manual Verify change always selects Core. Optional Core, Browser, PostgreSQL, compatibility-database and publication inspections remain separately selectable; a skipped optional route supplies no behavior evidence.

Observe a documentation PR, a code PR and a deliberately failed selected check before enabling the profile. Its proposed context is `Verify change`, supplied by the GitHub Actions app (GitHub.com app ID `15368`). Verify those values from the receiving repository's actual run.

## Documentation source

The `docs` branch owns publication data and media. Its verification wrapper calls the [trusted composite action](../actions/verify-docs/action.yml) at an accepted full `main` SHA. The action's own checked-in tools read the candidate as data. They install Node and the pinned scanner; they execute neither candidate scripts nor package installation. Their token is read-only and has no Pages deployment permission.

The initial contract checks the approved CNAME, the receiving LICENSE, ordinary paths and file types, case-distinct paths, relative Markdown destinations and quoted HTML `href`, `src` and `poster` destinations. It inventories media under explicit repository budgets: 2,000 files, 100,000,000 bytes per file and 1,000,000,000 bytes in total. A fresh committed snapshot supplies the scanner's input. Fragment targets, CSS/JavaScript references, rendering, scientific meaning, third-party rights and the final generated-site link graph keep their own review/build receivers. This check publishes nothing.

Generate the wrapper in a preparation directory after the action exists in the accepted public `main`:

```sh
node scripts/ci/create-docs-wrapper.mjs ACCEPTED_MAIN_SHA NEW_WORKFLOW_FILE
```

The generator verifies the action exists at that local commit and creates a new file. Place the result at `.github/workflows/verify-docs.yml` in the proposed docs change. Its stable job name is `Verify documentation`; verify the actual GitHub Actions context before enabling `docs.json`. Updating the pin is an explicit tooling upgrade with its own review.

## Activate in another receiving environment

1. Keep the existing branch coordinates, Pages settings, CNAME, bootstrap LICENSE and served-site recovery information with the owner's private recovery record.
2. Receive the reviewed `main` source and observe its checks. Installing these files changes no existing Pages publication setting.
3. Prepare a focused docs PR on a non-publishing feature branch with the pinned wrapper and approved `main` LICENSE. Preserve other docs content and CNAME, and keep the original bootstrap notice in the recovery record. Observe passing and deliberately failing checks and secure independent review before the owner decision.
4. Present that concrete PR and the Pages transition for owner approval. After approval, switch Pages from legacy branch publication to Actions, merge the reviewed docs PR, retain the domain and check the currently served result. Creating and checking the feature-branch PR itself publishes nothing.
5. Confirm the expected app/context and enable the respective branch profiles after the receiving observations. The files remain disabled until that owner action.

## Retain release identities

Both tag profiles match `app-v*` and `docs-v*`. The creation profile admits only the repository administrator role through its creation-only bypass (`RepositoryRole`, ID `5`, mode `always`). This is a role-wide authority: in the current solo-owner arrangement it serves the owner; adding another administrator expands who can create these tags. It names neither an invented individual actor nor a deployment app.

The separate retention profile blocks updates and deletions with **no bypass actors**, including for administrators. Keeping creation and retention separate allows the authorized owner to create a release identity while preserving that tag afterward. A later release receives a new tag. Before activation, confirm the account supports these rules and exercise allowed creation plus refused mutation/deletion in an owned disposable test repository. Check both effective profiles together; importing JSON alone establishes no enforcement result.

The [tagged documentation release](../../docs/runbooks/tagged-documentation-release.md) owns the reviewed static artifact, deployment environment and explicit activation. Creating an application or documentation tag through these profiles publishes nothing by itself. Repository visibility remains a separate human decision. Normal branch repair uses a revert or follow-up PR; an exceptional temporary protection change is recorded and the accepted profile restored afterward.

The [public-visibility handoff](../../docs/runbooks/public-visibility-handoff.md) carries these protections through an owner-approved change in repository access. It includes the public-fork approval policy, effective-setting readbacks and contributor checks; the versioned profiles alone establish none of those account observations.

[Automation routes](../../docs/development-automation.md) · [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) · [GitHub's administrator-role example](https://github.com/github/awesome-copilot/blob/main/skills/repo-standardizer/SKILL.md) · [Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
