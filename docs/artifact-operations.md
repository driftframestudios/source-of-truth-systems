# Artifact checks and revision proposals

Artifacts keeps the recorded files and their acceptance findings readable while visitors inspect local references and prepare a revision proposal. Gallery, Lineage and Comparison consume the same browser-session records. Reload starts from the supplied examples.

**Check local references** validates the title, type, release and revision, then resolves each `derivedFrom` entry against the accepted source records and original artifacts. A missing, empty or self reference produces a concrete failed check. The result describes the locally available metadata at the time of the check; run it again after source changes. Recorded scientific and visual acceptance findings retain their own status and notes. The comparison matrix derives its cells from those same findings; a dash means the finding was not recorded.

**Prepare revision** creates one metadata proposal linked to its original artifact. Visitors can edit the proposal title and planned change, save it for this browser session, or discard it and prepare again. The original title, revision, content hash, file size and acceptance evidence remain the record of the supplied file. File rendering and external build execution remain separate future operations.

`artifactWorkflows.ts` owns validation, typed commands, current permission checks and expected-revision checks. `artifactWorkflowContext.ts` initializes the feature lazily within the existing browser-session owner. Checks require `analysis.run`; proposal preparation, saving and discard require `workspace.edit`. Commands resolve their own canonical artifact and current source collection before accepting an operation. Other artifacts retain their existing state.

The focused unit contract observes broken/current references, retained evidence, proposal recovery and refused operations. The browser journey observes all three projections, navigation retention and read-only refusal. The ordinary Node build remains the delivery route.

This contract supersedes the earlier unavailable Regenerate / Re-run checks controls with named local operations. The application describes metadata preparation as a proposal rather than as a generated file.
