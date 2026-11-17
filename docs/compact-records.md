# Compact record workspaces

Cohort Builder and Artifacts keep the primary task readable at compact desktop widths while retaining their established wide layouts. The [Cohort](cohort-rules.md) and [Artifact](artifact-operations.md) contracts continue to own accepted operations.

## Composition decision

Persistent rails support comparison on wide screens. On a compact workspace, two Cohort rails squeeze the editable rule between them; a fixed Artifact inspector similarly compresses every gallery card. Smaller text would preserve those constraints, and a modal drawer would cover the record context. The receiving layouts instead use two bounded patterns:

- **Cohort:** below 1280px, one supporting rail switches between **Add cards** and **Rule & saved** beside the main editor. Matched, eligible and consent-held counts stay visible above the canvas. Saving a rule reveals its saved receiver. At wider sizes, the original left palette and right compiled rule remain visible together.
- **Artifacts:** below 1280px, selecting a gallery card gives that record the full working area. A fixed header keeps its title, release, revision and **Back to gallery** visible. Local revision/check controls sit beside the original acceptance and provenance material. The wide layout retains the three-column gallery and side inspector. Returning focuses the selected card.

Cohort tools and the Artifact gallery remain mounted while their compact alternatives are shown. Resizing changes composition through CSS rather than replacing editors, so an untouched editing draft retains its values. Explicitly leaving an editor retains the existing draft lifetime; accepted rules, proposals and check results remain with their browser-session owners.

## Source ownership and evidence

`cohort-builder.css` owns rail placement, compact tool states and the wrapping compiled-reading viewport. `artifact-workspace.css` owns gallery/detail geometry and the wrapping record viewport. Both consume existing theme roles. The comparison matrix retains its intentional horizontal pan. Mobile continues to use the dedicated Corridor/Plate workspace.

`tests/browser/compact-records.spec.mjs` observes usable primary-area width, rail selection, saved-rule return, draft retention across desktop widths, and Artifact return focus. Existing Cohort and Artifact journeys retain save/reopen/update/remove, proposal/check, refusal and responsive acceptance evidence. The Cohort containment cases reveal the compact rule rail before checking its full expression, consent and saved records. Settled before/after captures at 1024×768 and 1512×982 provide the visual comparison; interaction tests establish behavior separately from those images.
