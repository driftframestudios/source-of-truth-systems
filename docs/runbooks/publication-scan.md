---
title: Publication scan
version: 0.1.0
status: working
audience: solo repository owner and assisting agents
source_band: public_possible
task_type: operational_runbook
---

# Inspect a publication candidate

A receiving snapshot or release carries a verified source identity, a fresh-canary detector result and a clear account of what was inspected. This route preserves the current application and its Node/PostgreSQL delivery paths. The owner separately decides publication, repository visibility, credential rotation and any history repair.

## Enter with current source

Confirm branch, working changes and the intended commit. Preserve unrelated changes. Use Node 22.15+ within 22.x, Git, and the repository's ordinary build tools when inspecting generated output. A shallow clone can inspect its source; history mode waits for the owner-authorized ref acquisition. An unavailable binary or source selection returns an incomplete observation rather than a clean receipt.

The [installer](../../scripts/security/install-betterleaks.mjs) pins BetterLeaks **1.10.1** and official platform checksums. Install once into ignored `.tools/`; later scans work offline. The only scanner network step is this explicit download. Candidate validation and revocation remain disabled.

```sh
npm run test:security
npm run security:install
npm run test:security:engine
```

`test:security` exercises the wrapper, installer and ZIP boundaries without network or an installed engine. The separate engine check requires the verified binary; it proves a fresh canary and that exact fixture exceptions still detect the same value elsewhere and a changed value in an allowed file. Ordinary `npm test` excludes this preparation and engine work.

## Select one observation

Every `security:scan` invocation verifies the installation and generates a fresh non-issued canary before its chosen scope.

| Command                                                 | Material inspected and useful boundary                                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run security:scan -- canary`                       | Detector liveness, finding exit, parser and masking; source remains unobserved.                                                                                                                                                  |
| `npm run security:scan -- tree`                         | Current bytes of Git-tracked working files. Untracked/ignored files require an explicit artifact selection. Missing, symlinked or special tracked entries stop the scan.                                                         |
| `npm run security:scan -- index`                        | Every stage-zero index blob, including unchanged and skip-worktree entries. Unstaged bytes do not replace the proposed commit. Conflicts and submodules stop the scan.                                                           |
| `npm run security:scan -- export HEAD`                  | Complete selected committed source, materialized from raw Git blobs without checkout filters. A clean export does not inspect earlier history.                                                                                   |
| `npm run security:scan -- changed BASE_COMMIT`          | Added/changed committed files between the available base and `HEAD`. This is the ready-PR path; unchanged files and removed historical content remain with deeper scopes.                                                        |
| `npm run security:scan -- history`                      | Full-history textual patches across locally available refs, including separate merge diffs. Requires a non-shallow clone; unfetched refs, dangling objects, GitHub prose and binary bytes absent from patches remain outside it. |
| `npm run security:scan -- artifact dist`                | One contained generated directory, including ignored files. Symlinks and hidden scanner-ignore files stop the scan.                                                                                                              |
| `npm run security:scan -- artifact .deploy/release.zip` | Contents of one contained ordinary ZIP, safely materialized before scanning. This path is an example; select the actual reviewed archive.                                                                                  |

Materialized source and artifact receipts include a deterministic file-content identity. A ZIP additionally reports its archive digest. The parser accepts ordinary stored/deflated, single-disk ZIPs up to 100 MB, 256 MB expanded and 10,000 entries. Directory inputs are copied into an owned temporary snapshot before hashing and scanning; ZIP identities come from the same bytes that are extracted. It rejects encryption, ZIP64, unsafe paths, duplicate/colliding entries, symlinks and failed CRC/size checks. Nested archives receive no recursive expansion; name each required archive explicitly. Generic archive forensics remains outside this source-delivery route.

## Inspect a complete release

Use the reviewed revision and normal build owners. Build artifacts are generated from the working source, so confirm it equals the reviewed commit before reporting source-to-build identity.

```sh
npm run security:scan -- export HEAD
npm run build
npm run security:scan -- artifact dist
npm run security:scan -- artifact build
```

If a separate release archive will be delivered, select its exact path with `security:scan -- artifact`. Its producer owns membership, size and source identity; the scanner establishes only its declared detector result. The built-release workflow checks committed export plus `dist` and `build`. A receiving repository repeats applicable checks after assembling its source.

## Receive a result or recover

A clean receipt records the engine version, configuration digest, fresh-canary result, selected scope and safe source/artifact identity. Return that small result in the existing PR or Issue. Raw scanner reports and diagnostics remain transient in process memory; the wrapper prints no finding paths, candidate values or commit messages. Preserve the complete error as private context only when a protected receiver needs it.

A finding stops the affected handoff. The solo owner or authorized agent inspects the named source locally and determines whether it is a real credential, runtime indirection or non-issued fixture. A plausible credential goes to its provider owner for revocation/rotation before cleanup. Any history rewrite requires its own authorization. Exact synthetic exceptions live only in [`.betterleaks.toml`](../../.betterleaks.toml), with scope/rationale and a discriminating engine check; rerun the canary and affected scopes after changing one. Hidden ignore files, inline allowances and finding-count baselines do not participate.

The current exceptions cover disposable loopback CI credentials and two mocked unit fixtures. They authorize no hosted access. A changed value, path or rule remains observable. The detector's configuration and dependency defaults are version-bound; an upgrade reviews checksums, CLI/report behavior, canary, fixtures and real scopes together.

## CI and public carriers

[Publication scan](../../.github/workflows/publication-scan.yml) provides manual source, history and built-artifact selection. Verify change owns the complete committed-tree scan on every main PR. Clearing the optional scan's run_checks skips before allocation. Source scopes prepare Node and the scanner; release scope also builds the accepted source. Checks return normalized identity/results, while raw reports, caches and artifacts stay with their diagnostic owners.

Before a public handoff, inspect embedded image/archive metadata separately: location, device identity, authorship, timestamps and packaged paths. Preserve intentional color/profile/attribution fields. Review visible content, rights and intended audience with the owner. The generated `llms` documentation is another publication carrier and receives the build-artifact scan. Its source selection remains with the documentation generator and publication manifest owner.

Complete this route when every requested scope is clean or has a named private recovery owner, metadata/audience decisions are explicit, and the receiving record names the next action. A clean scan establishes no universal absence of secrets, provider validity or permission to publish.

References: [BetterLeaks stable release](https://github.com/betterleaks/betterleaks/releases/tag/v1.10.1), [GitHub secret-scanning scope](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-scope).
