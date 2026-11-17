# Source of Truth documentation publication

This branch holds publication data for the developer documentation at **kindlight.foundation**. The application, Markdown source, documentation renderer and build tools live on [main](https://github.com/driftframestudios/source-of-truth-systems/blob/main/README.md). This branch selects a reviewed application revision. Additional publication media remains a separately reviewed extension.

[site-release.json](site-release.json) pins the application commit, canonical origin and site-root base. Its initial media list is empty: the selected application revision supplies the admitted articles, generated GraphQL reference and existing documentation assets. [CNAME](CNAME) records the domain, and [LICENSE](LICENSE) retains the copyright and reuse terms.

To prepare a later publication, propose a focused PR to `docs` and update the application revision to a reviewed full commit ID. The current contract requires `media: []`; adding media first needs an accepted schema, rights review and bounded asset-copying behavior. The pinned [verification wrapper](.github/workflows/verify-docs.yml) checks this branch as data; it grants no deployment authority and does not execute scripts from the proposed documentation content.

An authorized documentation release binds an immutable `docs-v…` tag to this publication-data revision and the application revision it selects. The main-branch publication workflow owns the build and deployment. Merging a data edit or creating an application tag alone does not publish this site. Follow the [tagged-documentation release runbook](https://github.com/driftframestudios/source-of-truth-systems/blob/main/docs/runbooks/tagged-documentation-release.md) on main for preflight, activation and recovery.
