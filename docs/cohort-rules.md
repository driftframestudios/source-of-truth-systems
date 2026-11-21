# Cohort rules

The Cohort Builder saves named rule definitions for the current browser session. Visitors reopen a saved rule, update it, save a separate copy, or remove it. Removing a saved rule leaves its open draft available for recovery. Navigation and desktop/mobile layout changes preserve the saved collection; reloading the page starts a fresh collection.

This shared owner supersedes the earlier view-local rule snapshots. The palette, nested AND/OR/NOT canvas, result cards and compiled reading rail retain their visual roles. **Rule expression** describes the readable expression; the application evaluates its typed definition locally. A saved rule contains its name and predicate tree. Specimen records and result counts remain projections of the current accepted records.

## Ownership and acceptance

- `services/cohortRules.ts` owns the plain-data rule types and exhaustive semantic facet registry (options, comparison mode, formatter labels and evaluation), bounded copying validation and current-record projection. Its functional tree operations print expressions and count predicates. Its injected-ID factories build fresh preset descendants; the conventional root ID remains stable. Biomarker lookups are grouped by specimen once per accepted record snapshot.
- `services/cohortSession.ts` owns create/update/remove commands. Each command checks the current `workspace.edit` permission. Updates and removals require the revision the visitor opened; a stale draft remains available to save separately or replace by reopening the saved version.
- `services/cohortSessionContext.tsx` creates the feature resource in the existing browser-session owner. Its lifetime is independent of a mounted Cohort view. The feature adds no SQL writes, providers or deployment dependencies.
- `services/cohortEditor.ts` owns atomic draft transitions: tree, focus, selection and bounded-admission feedback. Removing an ancestor moves focus to the nearest surviving parent; unlinking preserves surviving descendants. Selection retains only surviving child nodes. Root behavior follows the supplied root ID. Edits copy changed paths and retain untouched branch references.
- `BooleanBuilderView.tsx` renders that draft and dispatches editor intent. It reads accepted specimens and biomarkers through the existing record projections. Order workflow and Biomarker review facets respond to accepted workflow edits; Pipeline stage continues to describe the bundled pipeline stage.

The typed UI adapter owns facet order, families, icons and accent tokens. Both empty AND and OR groups evaluate true before negation; the compiled explanation follows the same rule. The single-record interpreter retains short-circuit evaluation.

`inspectRuleDefinition` returns the first bounded finding with reason code, child-index path and safe node ID. `parseRuleDefinition` retains its definition-or-undefined contract. Acceptance copies only owned definition fields and validates names, group labels, unique node IDs, supported facet/value pairs, joiners and nesting. The limits are 120 characters per rule name, 100 per group label, 128 cards and eight nested levels. Draft operations apply the card/depth bounds before recursive rendering, matching or expression building. A rejected addition retains the existing canvas and explains how removing a card or unlinking a group makes room. Editable labels remain flexible until Save applies the full definition contract. A refusal preserves both the accepted collection and the visitor's open draft.

## Paint and geometry

`cohort-builder.css` owns the local paint adapter for group depth, predicates, focus/selection, expression and facet accents. Dark preserves the original navy surfaces and accent family. Light and High contrast pair those roles with the shared shell/status tokens, including result flags and markers. Facet labels and rule semantics remain separate from this presentation adapter. Theme changes preserve the mounted tree, focus, selected cards, draft name and saved rules.

`tests/browser/cohort-theme.spec.mjs` checks computed text against ancestor-composited solid/translucent backgrounds at laptop and compact-desktop widths, including hover and drag-over. Settled captures cover all three appearances. This bounded paint check complements visual inspection; gradients, images and general color-vision compatibility retain separate evidence needs.

## Matches and consent

The canvas, palette and saved-rule cards calculate from the same current records. **Matched** includes every record satisfying the definition. **Eligible** includes only matching records with active consent. **Consent-held** counts pending, rescinded and expired records separately. These records remain inspectable in the example result cards and stay outside the eligible cohort, including when the rule uses OR or negates consent. No patient-data export is implied by saving a definition.

## Evidence and continuation

`tests/cohort-editor.test.mjs` covers ancestor removal, linking order, stale IDs, root identity, branch sharing and draft bounds. The focused browser journey removes an ancestor and adds the next card at the reconciled destination. Laptop and compact-desktop captures cover the canvas; the existing responsive journey covers saved-rule retention across the mobile boundary.

`tests/cohort-session.test.mjs` exercises retained definitions, independent updates/removals, revision conflicts, current role/environment checks, malformed trees, accepted specimen/biomarker changes and consent partitioning. `tests/browser/cohort-rules.spec.mjs` observes save/reopen/update/copy/remove, a specimen hold changing a saved rule's count, responsive retention, a denied save retaining its draft, and reload reset. The existing metric comparison checks retain the explicit at-least/at-most target contract.

Durable user identity and server-owned rule storage remain separate receiving work. The existing Node server and stored-history paths retain their owners.
