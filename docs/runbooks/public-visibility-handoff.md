---
title: Public-visibility handoff
version: 0.1.0
status: working
audience: repository owner and authorized assisting maintainers
source_band: public_possible
task_type: operational_runbook
---

# Open the repository with reviewed contribution controls

Use this route when the owner explicitly authorizes making the named repository public. Preparation, passing checks and this document supply a reviewable handoff; they leave visibility unchanged. After an authorized transition, the receiving Issue or PR records the actual public state. A future collaborator can use that record to distinguish completed work from this reusable procedure.

## Prepare while access is restricted

Confirm the exact repository, accepted `main` and `docs` revisions, release tags and proposed visibility. Retain recovery coordinates and current Pages/Actions settings with the owner. Public forks can remain public after a later visibility reversal, so recovery focuses on correcting exposed material and restoring controls rather than recalling copies. [GitHub visibility effects](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)

Use the [publication scan](publication-scan.md) for the accepted source, available history and named generated artifacts. Review native images and file metadata separately. Include the GitHub material that will become accessible: Issues, PR discussions, releases, workflow histories, logs and retained artifacts. Inspect linked private locators and rights as well as credentials. A clean textual-history scan establishes its declared scope; historical binary files and unfetched refs need their own observation. GitHub makes Actions history and logs public with the repository. Keep raw findings private and resolve material exposure before the transition.

Record effective settings against the [protection contracts](../../.github/rulesets/README.md):

- `main` and `docs` require PRs, resolved conversations and strict current checks, with no bypass. Zero required approving-review badges supports the solo owner; independent technical review remains recorded.
- Release tags allow administrator creation and retain separate update/deletion prohibitions without bypass. Pages deployment admits `main` only.
- Actions uses read-only default tokens, cannot approve PR reviews, requires full-SHA action references, and preserves the accepted allowed-action policy. Private-fork execution, write-token and secret forwarding stay disabled. Private action/workflow sharing remains closed.
- Confirm the repository and environment secret/variable inventories, collaborators and installed integrations. Keep the current minimal authority unless a separate task requires more. Confirm Dependabot alerts; automatic security/version-update PRs are separate choices.

Check settings from the account, not just template JSON. The [Actions settings guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) and [Dependabot alert guide](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts) describe those controls.

## Carry out the approved transition

The approved public policy is `first_time_contributors_new_to_github`, GitHub's least restrictive option. It retains the platform's approval requirement only for contributors who are both new to GitHub and without a merged contribution to this repository. The repository adds no blanket external-contributor approval gate. The [permissions API](https://docs.github.com/en/rest/actions/permissions) defines the supported values and readback operations.

The readiness inspection found that GitHub refused a read of this repository's public-fork policy endpoint while it was private. Apply and read back the chosen minimum immediately after visibility changes. A short Actions pause can cover that transition interval when the owner chooses this sequence:

1. Hold merges and new release dispatches. Let owned active runs finish, or cancel them deliberately; confirm that no deployment remains in progress. Save the effective Actions policy so re-enabling preserves it.
2. Disable repository Actions and verify the result. This pauses verification and deployment workflows; plan the handoff when that interruption is acceptable.
3. The owner changes the confirmed repository's visibility to public.
4. Set and read back `first_time_contributors_new_to_github`. Recheck the settings above, including effective branch/tag protection, main-only Pages, SHA enforcement and token limits. Account capabilities can change with visibility; preserve each intended boundary through its actual supported setting.
5. Re-enable Actions with the saved allowed-action policy only after the required readbacks succeed. Keep merges held until the receiving checks below finish. If a boundary remains unconfirmed, leave Actions paused and return the precise setting and recovery action to the owner.

Review the exact candidate before merge, including workflow/action changes and code executed by package installation, builds and tests. When GitHub requests run approval under its minimum policy, perform that inspection before approving execution. A green check name supplements this review; it does not replace it. The [fork-run review procedure](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks) explains that occasional platform step; execution approval and merge acceptance remain separate decisions.

## Observe the public receiving experience

From a signed-out browser, open the repository, README images, source links and support/security routes; make a fresh unauthenticated clone. Confirm the available private vulnerability-reporting route against [SECURITY.md](../../SECURITY.md), retaining its safe contact-request fallback where needed.

Confirm that an owned, non-publishing PR receives the actual required check and merge restriction. Exercise one bounded selected-check failure, repair it, and observe the successful result at the repaired revision. Preserve the separate trusted docs-branch check. Use [selective checks](selective-check-delivery.md) rather than adding unrelated browser or database work to a visibility change.

Check the live application and Pages domain over HTTPS, including a direct documentation route and its assets. Repository visibility publishes source access; it does not rebuild either hosted surface. Deliver changed standalone articles through the [tagged documentation release](tagged-documentation-release.md). The application's `/docs/` remains part of its own Node build and deployment, so it receives those changes through a separate application release.

Close the handoff in one Issue or PR with accepted revisions, current visibility, settings readbacks, executed checks and their limits. Link existing sanitized evidence instead of duplicating logs. Real-user identity, private scientific records and broader product work retain their existing design boundaries. The owner then releases the merge hold; future contributors follow [CONTRIBUTING](../../CONTRIBUTING.md).
