# Workspace composition and return

Each desktop section keeps its primary task readable, supporting records reachable and accepted changes with their existing state owner. The common pattern is visible record identity, a bounded working area and an understandable return. Scene, rule, table and gallery tasks use different compositions to achieve it.

**Supersession:** Final-record and compiled-text containment remain in place. The current compact layouts resolve the later rail, action hierarchy and badge-contrast findings. The earlier recommendation to defer Cohort density and Plate rail work is replaced by the receiving patterns below.

## Choose the composition by task

| Task | Compact desktop composition | Wide composition and source owner |
| --- | --- | --- |
| **Find and inspect a source** | Search and type filters stay with the bounded collection; selected metadata and authority material have a wrapping reading viewport. | `SourcesView.tsx` retains the established collection/detail arrangement. [Source discovery](source-discovery.md) owns edits and recovery. |
| **Build a cohort rule** | Below 1280px, one supporting rail switches between **Add cards** and **Rule & saved** beside the editor. Match, eligible and consent-held counts remain visible. Saving reveals the saved-rule receiver. | Both supporting rails remain visible from 1280px. `BooleanBuilderView.tsx` and `cohort-builder.css` own composition; the [compact-record contract](compact-records.md) records the decision. |
| **Inspect an artifact** | Below 1280px, a selected gallery record uses the full working area. Its header keeps identity, revision and **Back to gallery** visible. Returning focuses the selected card. | The gallery and side inspector coexist from 1280px. `ArtifactsView.tsx` and `artifact-workspace.css` own placement. The comparison matrix retains its deliberate horizontal pan. |
| **Explore a permission scenario or preference** | Below 1280px, grouped Profile navigation moves above the content. The acting persona and environment stay visible while the Access Grid can inspect another person. | The grouped side rail returns from 1280px. `ProfileView.tsx` and `profile-layout.css` own geometry; [Profile preferences](profile-preferences.md) distinguishes scenario, personal and diagnostic controls. |
| **Read a sample's Plate history** | At 1024–1359px, **Sample histories** and **Sample details** open one local rail at a time over the stable scene. Close/Escape restores trigger focus; selecting a story reveals its result. The three-column result tray keeps its existing renderer. | Both rails sit beside the scene from 1360px. `LanesView.tsx` holds disclosure selection; `plate/PlateWorkspace.tsx` and `plate.css` own rendering, focus and this [Plate composition](plate-workspace.md). Below 1024px, the mobile workspace receives the same exploration intent. |
| **Read long lists or a graph** | Map's reference rail, Requirements, Decisions and Comparisons keep final records inside local scroll viewports while their summaries and filters remain reachable. | Their view components retain bounded record scrolling. Map keeps its intentional two-axis graph pan and lower artifact lineage strip. |

Specimens retains its [Cards/Table choice and topic-specific cell dialogs](specimen-table.md). Presentations retains [brief-specific formats and pagination](presentation-styles.md). These are deliberate receiving patterns for comparison and reading, alongside the scene and editing compositions above.

## Shared behavior, local geometry

Desktop resizing changes these layouts through CSS. Cohort tools, the Artifact gallery and Plate rail content stay mounted while their compact alternatives are shown; Profile preserves its selected content across the desktop breakpoint. The current editing draft therefore survives the layout change. Explicit navigation away from an editor follows that editor's existing draft lifetime. Accepted records, permission scope, preferences and Plate selections remain with their shared session or exploration owners.

Each panel owns its scroll boundary. Wrapping records and compiled rule text use a shrinkable reading viewport; comparison tables and Map retain intentional horizontal or two-axis movement. `cohort-builder.css` and `artifact-workspace.css` scope Radix measurement-wrapper adjustments to their own reading viewports. A shared drawer would obscure useful context in some of these tasks, so the implementation shares state and theme contracts while keeping composition local.

`StatusBadge.tsx` and `record-badge.css` provide the shared badge treatment. Source/type/category, requirement, acceptance and release labels pair typed semantic ink with an opaque tint in Light mode. Existing geometry and Dark/High contrast paints remain intact. [Appearance modes](theme-contract.md) owns the palette and contrast evidence; labels continue to carry meaning independently of color.

The mobile [Corridor/Plate contract](mobile-showcase.md), camera and scene motion, permission decisions, loading/source feedback and accepted workflow commands keep their existing owners. Layout choices expose those behaviors without adding another acceptance path.

## Receiving evidence and extension

- `workspace-scroll.spec.mjs` reaches the final Map reference, Requirement, Decision and Comparison, and the full Cohort expression, consent material and saved records. The compact Cohort receiver first reveals **Rule & saved**.
- `compact-records.spec.mjs` checks usable primary-area width, rail selection, saved-rule return, draft retention across desktop widths and Artifact return focus. Existing Cohort and Artifact journeys cover accepted commands, refusals and recovery.
- `profile-layout.spec.mjs` checks separated actor/inspection context, Access Grid reachability and draft/preference retention across the desktop breakpoint.
- `plate-workspace.spec.mjs` checks local rail entry/return, exclusivity, stable scene width, visible sample/source state and retained result selection across wide and mobile receivers. Existing Plate checks retain history loading, cache, late-response and command coverage.
- `record-badges.spec.mjs` measures rendered Light foreground/background pairs in Sources, Requirements and Artifacts, including selected cards. Focused before/after captures preserve the established Dark/High contrast treatment and badge geometry.

Settled 1024×768 and 1512×982 captures support visual comparison; the Plate family also checks its mobile boundary. These observations establish the named receiving states. Future sections can reuse a pattern when their task, state lifetime and return match it; a new common primitive follows a repeated need rather than a requirement to make every section identical. The [whole-view assessment](workspace-audit.md) records current operations and the next receiver. Return to the [repository guide](../README.md) for development and deployment.
