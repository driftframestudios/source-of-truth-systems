# Collaboration and delivery runbooks

Use the route that matches the receiving task. The [repository README](../../README.md) names current behavior and source owners; the active Issue or user instruction supplies scope and authority. A runbook orders already-authorized work.

| Route | Result | Standing |
| --- | --- | --- |
| [Focused change and independent review](focused-change.md) | One bounded change, fitting evidence and an independently reviewed handback | Working · v0.2.0 |
| [Select meaningful checks and deliver their result](selective-check-delivery.md) | A discriminating test, proportionate suite and explicit executed/skipped result, with explicit artifact scope | Working · v0.1.0 |
| [Publication scan](publication-scan.md) | A fresh-canary source/artifact observation, exact identity and private finding route | Working · v0.1.0 |
| [Tagged documentation release](tagged-documentation-release.md) | One reviewed static build, a verified artifact and explicit Pages activation | Exercised · v0.1.0 |
| [Dependency maintenance](dependency-maintenance.md) | A justified dependency update with its receiving behavior and delivery checked | Working · v0.2.0 |

The working runbooks consolidate recurring repository practice; each awaits an end-to-end exercise as written. Independent reading exercises can expose useful corrections while leaving that full-route standing open. Record decision-changing findings in the existing PR or Issue, then update standing when the route has been exercised. Git retains prior versions; the current index supplies discovery.

[GitHub workflows](../../.github/workflows) provide Core as the normal code/configuration PR check and manual browser, compatibility-database and publication-scan choices. The [selection contract](../development-automation.md) explains run/skip, narrow smoke and combined Core/browser options. Their YAML owns triggers, permissions and retention; the runbooks explain when their results fit the task. A completed check supplies evidence, while the current grant and independent review govern delivery.

Database setup remains a separate operator action. [Local PostgreSQL operations](local-postgresql-clone.md) owns initialization, startup, backup/restore and confirmed reset. [Visitor workspaces](../visitor-workspaces.md#deployment-and-evidence) names the bounded Source storage receiver. Ordinary application startup serves accepted outputs and existing data.

The local [skill-authoring contract](../../.agents/skills/declarative-skill-authoring/SKILL.md) and [writing guide](../../.agents/skills/declarative-skill-authoring/references/writing-and-evidence.md) support future instruction changes. Keep required methods and source links clone-local, name the actor and useful action, preserve exact boundaries, and distinguish authored examples from observed outcomes.

[Local PostgreSQL clone](local-postgresql-clone.md) supplies the isolated public-edition startup and recovery route, with per-clone storage and private credentials.
