---
name: declarative-skill-authoring
description: Authors and revises self-contained repository skills with precise routing, consequential rules and observable completion. Applies when repeated collaboration reveals a reusable method, a skill misroutes work, or a clone needs guidance that currently depends on conversation context.
---

# Declarative skill authoring

## Contract

- **What:** Turn an evidenced collaboration method into instructions another collaborator can select, apply, check and revise.
- **When:** A recurring decision needs more context than standing repository guidance supplies, or an existing skill fails to transfer to its next receiving task.
- **Boundaries:** User intent, repository policy, current source and granted tools retain authority. A skill supplies a method; activation grants neither publication permission nor proof of effectiveness. Direct reasoning remains the complete route for a one-off task.
- **Result:** A conventional `SKILL.md` and only the supporting resources needed to make its fit, actions, evidence and recovery legible in an independent clone.

## Fit and attention

- **Useful when:** A repeated ownership mistake, missing decision discriminator or recovery sequence can be captured as a transferable method.
- **Poor fit when:** The proposed skill repeats AGENTS, records one Issue's status, describes a single bug fix, or replaces one adequate command with a framework.
- **Smallest useful dose:** Revise the existing owner; create a new skill only when it owns a distinct receiving result.
- **Foregrounds:** Routing, authority, discriminating decisions, useful context and cold-reader completion.
- **May under-attend:** A coherent instruction document can still produce weak decisions. Receiving-task observations establish utility separately from structural validity.
- **Interactions:** The [test-suite skill](../test-suite-composition/SKILL.md) selects executable evidence. The [runbook index](../../../docs/runbooks/README.md) holds settled ordered routes. Issues own active scope and acceptance.
- **Rest or release when:** The reader can finish the bounded job, a simpler standing instruction absorbs it, or the receiving capability retires.

## Inputs, defaults and output

Read the current request, nearest README, applicable source, existing skill catalog in [AGENTS](../../../AGENTS.md), and the observation that prompted authoring. Name the expected receiver and a plausible near miss. A remembered failure is a hypothesis until current source or a receiving observation establishes it.

When evidence is incomplete, write a working method with the open question and the next discriminating observation. Existing behavior continues through its accepted owner. A missing account or tool capability becomes a named handback, rather than a skill dependency that a clone cannot fulfill.

The output is one skill directory under `.agents/skills/`, with `name` and third-person `description` frontmatter. Keep shared instructions in `SKILL.md`; link substantial conditional material one level below it. Load [the authoring pattern](references/authoring-pattern.md) when creating or structurally revising a skill. Load [the writing guide](references/writing-and-evidence.md) for material instruction or runbook prose.

## Rules

### Rule: Capability and trigger govern selection

The description names the method's result and the conditions that make it useful. Names identify the job, rather than a person, competency claim or task number. Include a poor-fit boundary when it prevents realistic misrouting. A broad topic such as React or security alone provides too little selection context.

### Rule: Contracts precede mechanics

State What, When, Boundaries and Result before the operating sequence. Separate an invariant from a convenient local implementation. A request-generation guard may be essential; its current variable name belongs in a source receiver link. Commands come from current package scripts and configurations rather than remembered conventions.

### Rule: Depth follows the decision

Include the inputs, default behavior, missing-input response, material output and recovery needed to act. Explain a non-obvious tradeoff where the wrong choice would change behavior. A longer skill earns its length through distinct decisions; repeated cautions and generic quality aspirations add reading cost without adding capability.

### Rule: Local dependencies travel with the clone

Every required local link resolves from the skill. A public source may supply provenance or optional deeper research; the operative method and required writing instructions remain available here. Replace workstation paths, private workspace locators and conversation-specific instructions with local owners and explicit entry conditions. Preserve source credit through a bounded public provenance link.

### Rule: Rules retain agency and exact boundaries

Name the collaborator, test runner, command owner or receiving view that acts. Lead with the desired state, classify each negation, and keep a necessary exclusion beside its permitted route. Preserve test assertions, legal/privacy boundaries, exact quotations and uncertainty. The writing guide provides the complete local method and its evidence limits.

### Rule: Examples clarify a branch

Retain the smallest scenario set that changes a decision: an ordinary path, consequential boundary or near miss. Each scenario names initial state, event, observable result and recovery when needed. Authored Given/When/Then prose expresses intent. Link an executable test explicitly when one supplies observation; the prose itself remains instruction evidence.

### Rule: Reuse retains ownership

A portable skill owns the general method; this repository owns its local adaptation and source map. A companion runbook sequences an already understood route. Supporting skills own distinct results and keep their own completion conditions. Avoid requiring another entire skill merely to retrieve one local fact.

### Rule: Helpers follow repeated mechanics

An instruction-only skill is a complete first version. Add a script when repeated, fragile work demonstrates a useful deterministic boundary. Exercise that script's meaningful success and refusal paths. Validation of frontmatter or links establishes structure; it leaves the skill's decision quality open.

### Rule: Outside evidence reopens the method

Human correction, source changes, a cold-reader failure or an independently grounded source can revise the contract. Reuse counts and self-authored examples describe activity. They establish neither correctness nor universal transfer. Narrow, combine or retire guidance when its receiving job changes.

## Operating sequence

1. **Locate:** Identify the current outcome and existing instruction owner. Decide whether a direct answer, skill revision, new skill or runbook best serves it.
2. **Bind:** Name the receiver, active authority, source owners and smallest useful intervention. Retain unavailable evidence as an explicit open item.
3. **Write:** Draft metadata and contract, then the decisions and actions that change the outcome. Link conditional context at its load point.
4. **Review language:** Use the writing guide on headings, tables, examples and code comments as well as prose. Preserve supported actors, claim strength and boundaries.
5. **Check structure:** Verify frontmatter, local links, real commands and source receivers. Read the skill from an independent-clone vantage.
6. **Exercise:** Give a fresh reader a realistic task, the skill and minimum raw source. Keep the expected answer out of the task. Add one near miss when routing is uncertain. Compare its actual decisions with source and acceptance.
7. **Settle:** Fix decision-changing friction, update AGENTS discovery and hand back one concise review record. State what was exercised, what remains unobserved, and the event that would reopen the skill.

## Consequential examples

### A repeated local number looks like a universal rule

- **Given:** The current showcase bounds an API resource to a small process-local limit.
- **When:** The author captures its admission-lifetime method.
- **Then:** The skill preserves ownership and cleanup rules, links the configured limit, and lets the receiving workload determine its value. A different deployment reopens capacity selection while preserving the lifetime invariant.

### A simple caption edit reaches the skill catalog

- **Given:** One caption needs a direct wording correction and existing writing guidance covers it.
- **When:** The collaborator considers adding a skill.
- **Then:** The collaborator makes the authorized edit and checks its meaning directly. A new skill waits for a distinct recurring method or observed gap.

## Recovery and completion

If an exercise misroutes a task, revise the smallest trigger or decision that caused it and repeat that case. Keep a disputed behavior with its current source owner until evidence or user direction resolves it. An unsuccessful experiment can settle with a narrower skill or a documented direct-reasoning route.

Complete when a fresh reader can identify fit, execute within authority, interpret evidence and recover using this repository alone. Record independent exercise separately from runtime tests. Reopen on a material source, environment or receiving-task change.

## Provenance

Adapted from the public [exemplars skill-authoring contract](https://github.com/driftframestudios/human-ai-systems-exemplars/blob/main/.agents/skills/declarative-skill-authoring/SKILL.md). This local contract and its references supply the complete receiving method; upstream research and future revisions inform review rather than silently changing repository instructions.
