# Application and state owners

Start here when changing the interface or the behavior behind a visible control. [App.tsx](App.tsx) holds shared providers above the responsive workspaces. [DesktopWorkspace.tsx](DesktopWorkspace.tsx) and [MobileShowcase.tsx](components/mobile/MobileShowcase.tsx) render the current projection; they do not own duplicate copies of accepted records.

## Find the behavior

| Change | Source owner | Contract |
| --- | --- | --- |
| Current section, scene, camera, well or result across resize | [ExplorationProvider](services/exploration/ExplorationProvider.tsx) | [Mobile](../../docs/mobile-showcase.md) and [workspace layout](../../docs/workspace-layout.md) |
| Shareable views and browser Back/Forward | [navigation](services/navigation/) | [Shareable navigation](../../docs/shareable-navigation.md) |
| Accepted workflow records | [browserSession](services/browserSession.ts) and feature services under [services](services/) | [Whole-view assessment](../../docs/workspace-audit.md) |
| Command authorization | [permissionPolicy](services/permissionPolicy.ts), [writeGate](services/writeGate.ts), [recordCommands](services/recordCommands.ts) | [Permission scenarios](../../docs/permission-scenarios.md) |
| Source draft, local edit or hosted save | [sourceEditor](services/sourceEditor.ts), [sourceSession](services/sourceSession.ts), [sourceWorkspace](services/sourceWorkspace.ts), [workspaceTransport](services/workspaceTransport.ts) | [Source discovery](../../docs/source-discovery.md), [workspace recovery](../../docs/visitor-workspaces.md) |
| Scoped Plate history and cache | [plateHistory](services/plateHistory/) | [GraphQL reads](../../docs/graphql-read-api.md) |
| Corridor/Plate paint and movement | [corridor](components/corridor/), [plate](components/plate/), [mobile](components/mobile/) | [Plate workspace](../../docs/plate-workspace.md), [loading](../../docs/loading-experience.md) |
| Appearance and shared status | [theme](theme/), [StatusBadge](components/StatusBadge.tsx) | [Theme contract](../../docs/theme-contract.md) |
| Walkthrough requests and control handback | [guide](components/guide/) | [Guided exploration](../../docs/research/guided-exploration.md) |

Feature services resolve the canonical record, current permission and revision before accepting a command. Views submit intent and render the result. Local workflow records survive navigation and responsive remounts for the current app session. Hosted Source metadata has its own expiring workspace and revision namespace; an uncertain save retries the original command identity. Keep an editor draft separate from accepted state so a refusal or late response remains recoverable.

[data](data/) owns the synthetic baseline. [src/server/example-data.ts](../server/example-data.ts) projects it into a private server build. Change a record at its owner instead of creating a second example in a component. [Fixture provenance](../../docs/fixture-provenance.md) explains what the data represents.

## Verify the receiving behavior

Use [the test map](../../tests/README.md) to select the matching owner check and one relevant browser journey. A visual change also earns a settled capture at its affected viewport; a resize change earns the same selected record before and after the boundary. The local [responsive-intent skill](../../.agents/skills/responsive-intent-handoff/SKILL.md) and [draft-recovery skill](../../.agents/skills/async-draft-recovery/SKILL.md) describe those ownership decisions.

Keep deferred Desktop and Plate entry points intact when adding imports. The build-dependent startup test checks the actual emitted graph; a source-only reading cannot establish download size.

[Documentation](../../docs/README.md) · [Repository](../../README.md)
