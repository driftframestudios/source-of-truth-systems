---
title: Release a reviewed documentation build
version: 0.1.0
status: working
audience: repository owner and authorized maintainers
task_type: operational_runbook
---

# Release the documentation independently

Publish the reviewed static documentation at `https://kindlight.foundation` while the application continues at `https://kindlight.ai`. The application's `/docs/` projection keeps its own build and delivery path. This route changes the Pages artifact; repository visibility remains a separate owner decision.

## Enter with accepted source

Use the protected `main` and `docs` branches and their active review checks. `main` owns the application, documentation generator and trusted release tools. `docs` owns reviewed publication data and its immutable `docs-vMAJOR.MINOR.PATCH` tags. The Pages source is **GitHub Actions**, and the `github-pages` environment admits deployments from `main` only. The repository owner confirms these settings before activation.

The initial `site-release.json` on `docs` contains:

```json
{
  "version": 1,
  "appRevision": "<full accepted main commit>",
  "origin": "https://kindlight.foundation",
  "base": "/",
  "media": []
}
```

The publication commit also retains the approved `CNAME` and exact `LICENSE`. This first release uses the documentation generator's existing assets; a nonempty media list needs a reviewed extension of its path, attribution and rendering contract. The config contains data, and the release tools never execute files from `docs`.

Merge the config through its ordinary reviewed docs PR, then create its immutable documentation tag under the repository's tag authority. `appRevision` binds that tag to one accepted app source. App tags remain independent. A later app revision receives a new config commit and documentation tag. Tag protection preserves accepted references; an unsuccessful preflight leaves a tag as an identifiable source selection, rather than proof of a deployed site.

## Build once and receive the artifact

Run **Documentation preflight** from `main`, supplying the full app commit, full docs commit and its documentation tag. The action validates all three commit identities, accepted ancestry and config/tag agreement before dependency installation. It builds the foundation profile once using the selected app's locked toolchain. The trusted workflow and validators come from the dispatch's accepted `main` revision, which may be newer than the selected app revision.

Preflight checks generated article routes, ordinary local HTML links and assets, canonical origin, the isolated documentation module graph, ordinary file paths and the complete artifact's fresh-canary publication scan. Its normalized summary names:

- App, publication and preflight workflow revisions.
- Documentation tag, run ID and attempt.
- Sorted file-manifest SHA-256, file count and total bytes.

The immutable artifact retains `site/`, `manifest.json` and `receipt.json` for **14 days**. Inspect the generated pages from that artifact before activation, including a direct article, an internal link, appearance controls and one narrow viewport. Preserve intentional attribution and review any new media metadata under the [publication scan runbook](publication-scan.md). The automated link check covers quoted HTML destinations and file presence; visual quality, external destinations and fragment behavior remain receiving observations.

This workflow has read-only repository permissions. It neither deploys nor creates tags. A successful run proves its named source and artifact checks; a local build or failed run supplies no deployment receipt.

## Activate those same files

Run **Activate documentation** from `main` with the successful preflight run ID, the reviewed file-manifest digest and documentation tag. Select **activate_deployment** only for the owner-authorized publication. Its default `false` skips allocation and deployment.

Activation accepts a successful manual preflight from this repository's protected main workflow, selects the artifact for that exact run attempt, and verifies its ID, receipt, accepted source ancestry, immutable tag and every file hash. It scans the receiving artifact, then transfers the same static files into the current run's Pages artifact. It performs **no rebuild**. A fresh preflight is the recovery route for an expired artifact; receive its new digest before activation.

Only the final deployment job holds `pages: write` and `id-token: write` in the `github-pages` environment. That job runs the pinned GitHub Pages deployment action. The preceding verification job has read-only repository and Actions access. Every third-party action is pinned to a full commit. Main-only dispatch guards reject a mistakenly selected branch; environment restrictions supply the second deployment boundary.

After deployment, open the foundation site signed out. Check the home page, direct article refresh, asset loading, a narrow viewport, appearance controls, a missing route, HTTPS and the canonical domain. Confirm the application link still reaches `kindlight.ai`. A private source repository continues to require an invitation even when its Pages documentation is publicly readable; retain the documentation's access note until the owner changes that visibility deliberately.

## Recover and hand back

Keep the currently served site while a candidate fails. Correct the owning source through review and create a new publication commit/tag when the selected source changes. For a prior accepted release, activate its retained verified artifact and digest, or rerun preflight for the same immutable app/docs pair and receive the newly built artifact. A rebuild is a new artifact observation even when its source coordinates match. Release artifacts use ordinary Pages storage and retention; they are not a permanent backup service.

Complete the return in the existing release PR or Issue: selected tag and three revisions, preflight and activation runs, manifest digest, normalized checks, signed-out host result, and any remaining host or visibility action. Keep raw logs, credentials and account details with their protected owners. The runbook remains **working** until its first end-to-end hosted receiving exercise is recorded there.

## Source and focused proof

- [Preflight workflow](../../.github/workflows/documentation-preflight.yml) and [activation workflow](../../.github/workflows/documentation-deploy.yml) own invocation, permissions, artifact transport and retention.
- [Release tools](../../scripts/documentation/release.mjs) own accepted coordinates, finite config, deterministic file manifest and activation validation.
- [Focused tests](../../tests/documentation-release.test.mjs) distinguish altered files, missing paths, mismatched source/tag/receipt, another run attempt and unsafe path material. Run `node --test tests/documentation-release.test.mjs`; semantic Actions validation also uses `actionlint` against both workflow files.
- [Documentation implementation](../site/implementation.md) owns article generation and both build profiles. [Protected review](../../.github/rulesets/README.md) owns branch/tag rules and activation prerequisites.

Official references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [cross-run artifact download](https://github.com/actions/download-artifact), [Pages artifact preparation](https://github.com/actions/upload-pages-artifact), [Pages deployment](https://github.com/actions/deploy-pages). Pages receives static files; Node and GraphQL continue through the application deployment.
