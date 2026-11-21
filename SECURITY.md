# Security

This repository demonstrates workflows with synthetic records. Selectable personas model policy; they are not verified human accounts. Optional visitor workspaces store bounded Source metadata under an expiring server-issued cookie. Deployers should use the example for evaluation and development; private patient records and real multi-user clinical operations require a separately designed identity, authorization and operational boundary.

## Report a sensitive finding

When this repository's **Security → Report a vulnerability** control is available, use that private GitHub route. Its availability depends on the maintainer's repository settings and is not established by this file.

If that control is unavailable, open an issue asking the maintainer for a private reporting channel, using only a general subject such as “Private security contact requested.” Wait for an agreed private route before sharing reproduction details. Keep exploit payloads, credentials, cookies, personal records and unpublished vulnerability details out of public issues and pull requests.

In the agreed private report, include the affected revision, component, prerequisites, a synthetic-data reproduction and the observed impact. The maintainer can then assess the input path, scope and repair with you. Avoid probing hosted systems beyond your authorization; a local clone is the normal investigation environment.

## Supported source and deployment boundaries

The current `main` source is the maintenance target. Older snapshots and personal deployments need their own update decision; the project does not promise a long-term support schedule. The root package and lockfile identify the dependency graph to assess.

The [input assessment](docs/research/input-boundaries.md), [GraphQL contract](docs/graphql-read-api.md), [permission scenarios](docs/permission-scenarios.md) and [workspace contract](docs/visitor-workspaces.md) describe the implemented boundaries and their limits. Registered GraphQL operations and scenario permissions are useful controls, but neither establishes a person's identity. Keep database settings in the hosting secret store or an ignored local environment file. Ordinary application startup preserves stored data; schema setup is an explicit operator action.

## Dependency assessment and trusted glob inputs

The November 21, 2026 reassessment supersedes the November 17 open-finding
assessment. GitHub [withdrew GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
on November 18 and identifies the report as outside its security-issue scope.
The withdrawal is the resolution for [Issue #13](https://github.com/driftframestudios/source-of-truth-systems/issues/13);
this change retains the locked versions. The registry still lists `picomatch@4.0.7`
as latest. The full `pnpm audit --json` and production `pnpm audit --prod --json`
returned zero reported vulnerabilities for the reviewed lockfile. These are dated
registry observations; future advisories and application-specific input reviews
remain separate checks.

The [lockfile](pnpm-lock.yaml) resolves `picomatch@4.0.7` through Vite `6.4.6`,
`tinyglobby` and `fdir` in the development/build graph. `pnpm why picomatch --prod`
returns no production dependency path. The production [Node server](scripts/serve.mjs)
serves built assets and GraphQL; Vite owns development and builds.

Keep glob patterns in reviewed developer configuration: [asset matching](vite.config.ts),
[story discovery and watcher exclusions](vite.figma.config.ts), and
[Tailwind source scanning](src/styles/tailwind.css). Application forms, URLs and
GraphQL inputs remain data for their own bounded parsers rather than glob-pattern
sources. A future feature that receives external patterns needs an explicit input
and execution-cost boundary before enabling them.

Reassess when an advisory changes, dependency consumers or glob configuration
change, or a proposed feature exposes new pattern inputs or development-server
access. The [dependency runbook](docs/runbooks/dependency-maintenance.md) carries
the fitting check and review route. Keep development tooling in its development
environment and use the production server for hosted application delivery.

[Return to the repository](README.md) · [General support](SUPPORT.md)
