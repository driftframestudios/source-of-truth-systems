# Source-of-Truth Life Sciences

React, Vite, and Tailwind visual prototype with an isolated PostgreSQL clone and an ordinary Node server. Read `README.md` for the deployment and local development routes. Preserve the existing interface while addressing the current task.

- `npm run dev:source` runs the local Vite server with hot reload.
- `npm run build` produces `dist`; `npm start` serves that production output.
- `npm run dev` and `npm run dev:source` run Vite for interface development; Node build/start owns the GraphQL APIs.
- `scripts/serve.mjs` owns production HTTP serving and the platform `PORT`.
- `vite.figma.config.ts` retains asset resolution and page metadata transformations.
- `.figma/make/site.json` owns the application title and description.
- `.mise.toml` and `package.json` pin the Node/pnpm toolchain.

Follow the project guidance in `guidelines/Guidelines.md` when it applies. Keep publication artifacts tied to reviewed source; local caches, environment files and dependencies stay with their private owners.

## Continue a collaboration

Confirm branch, working changes, current issue and nearest source owner before editing. Preserve unrelated work. [Runbooks](docs/runbooks/README.md) carry the focused change, dependency maintenance, database recovery and Node deployment routes. [Automation](docs/development-automation.md) names what each Action establishes and the operator steps that remain separate. Independent review receives the exact proposed revision and its proportionate evidence before an authorized merge.

Repository skills under `.agents/skills/` provide focused reasoning when their trigger fits:

- [publication-boundary](.agents/skills/publication-boundary/SKILL.md): inspect exact source and artifact scopes with a canary-proven detector, sanitized results and a separate metadata reading.
- [test-suite-composition](.agents/skills/test-suite-composition/SKILL.md): design a discriminating test, select its smallest useful suite, and choose CI depth while preserving source identity and cleanup.
- [declarative-skill-authoring](.agents/skills/declarative-skill-authoring/SKILL.md): create or revise self-contained skills and their runbook companions from an observed recurring method.
- [responsive-intent-handoff](.agents/skills/responsive-intent-handoff/SKILL.md): retain exploration across layouts and deferred scene receivers, including guide cancellation and manual takeover.
- [scoped-record-boundaries](.agents/skills/scoped-record-boundaries/SKILL.md): align command acceptance, related reads and cache publication with current canonical identity and permission scope.
- [async-draft-recovery](.agents/skills/async-draft-recovery/SKILL.md): distinguish submitted drafts, accepted records, editor generations and workspace namespaces during hydration or retry.
- [resource-admission-lifetimes](.agents/skills/resource-admission-lifetimes/SKILL.md): keep request capacity attached to underlying work until cleanup, even when an HTTP deadline has already returned.

Use the smallest fitting method. These skills guide decisions; user authorization and the actual source determine scope. Local scenario roles demonstrate policy; verified accounts and private-data authority remain a separate future decision. Source publication keeps credentials, private locators and raw traces with their existing private owners; a PR summarizes the receiving behavior, checks, coverage and recovery.

## Maintain reusable instructions

The [selective check runbook](docs/runbooks/selective-check-delivery.md) carries a known route from a changed owner to focused evidence, optional deeper checks and a reviewed return. Add an executable case when it distinguishes a consequential plausible fault; preserve independent expected outcomes and bounded fixture cleanup. Source maps and configurations determine current populations, so a copied test count remains an observation of its named revision.

Skills and runbooks use the local [writing and evidence guide](.agents/skills/declarative-skill-authoring/references/writing-and-evidence.md). Name the responsible actor and action, lead with the intended state, and classify negation before revising it. Exact safety, compatibility, privacy and executable boundaries retain their meaning beside a useful continuation. Distinguish authored scenarios, structural checks, independent exercises and runtime observations.

Keep required guidance and source links inside this clone. Public upstream references provide provenance and deeper research; future collaborators can apply the local methods without another checkout, account or conversation. Revise the existing instruction owner when it already carries the job. A new helper or catalog earns its place through repeated mechanics or a consequential boundary.
