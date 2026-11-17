# Specimen cards and cell exploration

Specimens starts with its visual masonry atlas: accession and patient, indication and material, consent, coverage, recorded timeline and current workflow. A Cards / Table switch gives the same collection a compact comparison view. Search, filters and sorting belong to that collection, so switching representations retains the visitor's scope. Accepted records stay with the shared session owner.

**Supersession:** #83 replaces #49's inline expanding-row interpretation. Selecting a table cell now opens that cell's information group in a modal. The row remains compact. The earlier decision remains in Git history; it is no longer the interaction contract.

## Reading and interaction contract

Eight columns distinguish specimen/patient, assay/material, sample, review, order, quality, history and consent/region. The first column carries the row identity with `th scope="row"`; every column has `th scope="col"`. A cell is a native button whose accessible name includes the exact accession and destination topic. Table headers sort ascending, descending, then return to original order; `aria-sort` reflects the selected direction. A shared Sort by control offers the same ordering in Cards.

Collection search covers owned display terms and literal identifiers, including patient, well, assay and current states. Assay, recorded stage, consent, priority, order and quality facets combine. The visible count reflects the filtered collection; the summary rail labels whole-register totals. Clear filters restores the collection without changing the chosen sort. Reset sort restores canonical source order. An empty result offers a clear return.

The selected cell opens one live specimen and the relevant topic: Sample context, Sample workflow, Clinical review, Order workflow, Quality & coverage, Recorded history, or Consent & provenance. Topic navigation stays inside that record. Previous/Next follows the current filtered and sorted collection while retaining the topic. A consent cell explains the consent source, geography and data class; it does not infer a file relationship from a well coordinate alone.

The dialog resolves its selected accession against all accepted records. If an action removes the record from the active filter, the modal remains open, displays the accepted result and states “Outside current filters.” Closing returns focus to the originating cell or card control; if that control has left the collection, focus returns to the register. Escape, the close control and the modal overlay all use the same dismissal path. Sorting/filtering and scroll position remain in place behind the dialog.

Radix Dialog owns modal semantics, focus containment and Escape. Motion supplies a short spring from the selected control's vicinity and a restrained return. Reduced motion removes the translation/scale transition. The title receives opening focus, the topic rail remains visible, and the body scrolls within the viewport. No record mutation is tied to animation completion.

## Visual fidelity

Masonry preserves the original card hierarchy and varied content heights, with three columns at laptop width, two near the desktop boundary and four on wide screens. Coverage bars, dotted timelines, inline workflow strips, priority chips and consent-colored edges retain the original expression through shared theme tokens. The layout remains native CSS columns; cards keep their whole content together.

The table uses the same navy, teal selection and sky/violet/amber status language. It fits a laptop workspace and allows local horizontal scrolling at the desktop boundary; the identity column and header remain visible. Each cell's whole area is clickable, with a quiet outline on hover and a visible keyboard focus. Status, priority and consent always retain text. Light and High contrast use the existing semantic palette rather than filters over Dark artwork.

The dialog is a compact raised record surface. It keeps identity and topic navigation above the scrolling body and collection navigation below. Zero-valued tumor/variant metrics remain values; unavailable plate assignment reads “Not assigned.” Recorded stage and dated timeline remain source facts, while sample, review and order reflect accepted local changes.

Every specimen metric declares its target direction as `gte` (at least) or `lte` (at most). Cards and expanded quality show that qualifier beside the unchanged raw value, target and unit. The duplication-rate example meets its at-most target; depth, coverage and the remaining supplied examples declare at-least targets. These are synthetic source contracts, independent of metric names or clinical threshold inference. A shared comparison owner supplies both metric color and Cohort Builder's **All metric targets met** predicate and result strip. An empty metric collection remains unassessed rather than satisfying the predicate. QC flags remain separate recorded findings, so meeting one target never clears a flag. This supersedes the inherited all-at-least rendering recorded before #48.

## Table engine decision

| Option                                        | Fit for this register                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Native table with custom sorting/filter state | Small dependency surface; duplicates generic state and ordering machinery as collection operations grow                                      |
| TanStack Table                                | Headless, typed row models preserve native markup and this application's complete visual ownership                                           |
| AG Grid Community                             | Mature sorting/filtering and grid interaction; its grid renderer and additional features exceed this ten-record comparison's needs           |
| MUI X Data Grid                               | Integrated styled grid; its Material component model changes the design integration, and the community edition limits combined filters/sorts |

Use **TanStack Table 9.3.1**, pinned with its lockfile. The published package supports React 18 or newer. Register sorting, column filtering and global filtering with only the comparator/functions used here. The view controls the small sorting/filter state and supplies a stable accepted-record collection. Native HTML and source-owned components render the result. Row virtualization, pagination and a second local record store add no value to this complete ten-record register.

The dependency is imported through the deferred Desktop workspace, alongside the existing Radix Dialog and Motion owners. The production manifest and startup budget check verify that initial mobile delivery still excludes the desktop table. The frozen dependency graph and ordinary build own the emitted browser assets.

Sources: [TanStack installation](https://tanstack.com/table/latest/docs/installation), [headless model](https://tanstack.com/table/latest/docs/overview), [sorting](https://tanstack.com/table/latest/docs/framework/react/guide/sorting), [column filtering](https://tanstack.com/table/latest/docs/framework/react/guide/column-filtering), [AG Grid editions](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/), [MUI filtering](https://mui.com/x/react-data-grid/filtering/), [MUI sorting](https://mui.com/x/react-data-grid/sorting/), and [native row/column headers](https://www.w3.org/WAI/tutorials/tables/two-headers/). These sources inform the engine/semantic decision; browser observations establish this composition's behavior and geometry.

## Source ownership and evidence

- `components/views/SpecimenView.tsx` owns the current representation, collection controls, selected accession/topic and source-focus return.
- `components/specimen/specimenCollection.ts` owns typed columns, display topics, facets and search terms; TanStack derives one ordered/filtered collection for both renderers.
- `SpecimenCards.tsx`, `SpecimenCell.tsx` and `SpecimenDialog.tsx` own their respective projections; `SpecimenDetails.tsx` shares coverage, history, consent and workflow modules.
- `services/specimenQuality.ts` owns declared metric comparisons and target wording. `data/index.ts` owns their synthetic values, units and directions; `BooleanBuilderView.tsx` consumes the same comparison for cohort matching and result-strip color.
- `specimen-table.css` owns the atlas, comparison and dialog geometry. Existing theme tokens supply all appearance modes.
- `useSpecimens`, record transitions and `useWriteGate` retain accepted-state and permission authority. The mobile workspace continues to prioritize Corridor and Plate.

Focused browser cases establish default cards, exact topic/record association, keyboard open/close/focus return, independent expected date order, combined filters, empty recovery, accepted edits visible in both forms, held-consent refusal, and retained modal state when an edit leaves its filter. Existing permission, theme and navigation journeys continue against the new representation. Typechecking, production build and startup checks establish integration and deferred delivery. Visual checks cover laptop/desktop-boundary geometry and the spring landing state; artifacts remain in ignored `.visual-runs`.
