# Example data and reuse

The bundled examples help visitors explore genomics workflows, sample histories,
provenance and resource decisions. The repository combines generated plate data
with curated scenario records; it loads these examples from source rather than a
live laboratory system.

| Example family | Source and purpose |
| --- | --- |
| Plate wells and result histories | [Application data](../src/app/data/index.ts) and [well results](../src/app/data/wellResults.ts) generate repeatable values from fixed seeds and supply curated rerun, recovery and storage stories. |
| Specimens, biomarkers and workflow records | [Application data](../src/app/data/index.ts) supplies scenario findings, evidence labels, therapy associations and review states for exploring the interface. Scientific names retain their ordinary meanings; the supplied associations belong to these examples. |
| People, roles and access | [Access examples](../src/app/services/accessService.ts) use reserved `.example` addresses and scenario grants. Consent and data-class labels exercise policy behavior; verified identity and actual record provenance require their own implementation. |
| Server responses | [Server example data](../src/server/example-data.ts) projects the same collection for the GraphQL example adapter. Hosted history and disposable-workspace adapters have separate persistence owners. |

Regional key/residency explanations, the ten-year retention entry and release
signature checkpoints describe the scenario's organizational assumptions. They
are not general regulatory requirements or compliance determinations. Operational
reuse calls for organization-reviewed policies and independently validated
scientific findings.

Cloud bucket labels, masked account references and storage locations depict an
example infrastructure arrangement. Provisioned environments supply their own
coordinates and server-side credentials. Stable legacy identifiers connect
records and accepted edits; their wording carries compatibility meaning rather
than a dependency on an earlier workspace.

## Extend an example

Edit the owning source collection, then run `npm run typecheck`,
`node --test tests/fixture-catalog.test.mjs` and `npm run build`. The private-data
Vite build invokes [the fixture contract](../scripts/fixtures/catalog-contract.ts)
before publishing its module. The contract is build-only; visitor transport and
stored records retain their runtime admission boundaries. A failure identifies
the collection and field to repair. Plate's existing parser retains its own
bounded record diagnostics.

| Relationship | Accepted targets and absence |
| --- | --- |
| Requirement source, decision sources, landmark source; generation packet active records | Existing Sources or Instructions in the named collection. Lists may be empty. |
| Artifact parents, relationship endpoints | Sources or Artifacts. Source identity takes precedence when collections share an ID, matching artifact review. Artifact-only lineage is acyclic; a parent is distinct from its child. |
| Comparison items | Sources, Artifacts or Instructions. |
| Map edge endpoints | Map nodes; reciprocal graph links remain valid. |
| Corridor cards, flags, labels and connections | Lanes; a connection may have a null lane. Card artifact/stream references and typed cross-reference lists are optional and resolve in their named collection when supplied. |
| Corridor arrows; stream producer/consumer | Cards for both arrow endpoints; Lanes for streams, with a nullable consumer. Reciprocal workflow arrows remain valid. |
| QC gates; biomarkers | QC metrics; Specimens. |
| Wells, specimen anchors and result ownership | Optional card, well-coordinate and specimen references resolve when supplied. |
| Result files and history | Lifecycle rules exist. [Plate admission](../shared/plate-records.mjs) checks well/result identity, ordered supersession, earlier reused files and consistent physical-file metadata. |

IDs are unique within each owned collection. Physical-file keys intentionally
repeat across results. Result physical plate IDs, sample codes, change-control
references, descriptive text and generation-packet deferred topics retain their
own meanings; the fixture contract treats these as context rather than local
foreign keys. Scientific validity and clinical interpretation receive separate
review.

Collection indexes and iterative lineage frames use O(V) auxiliary space; each
entity and reference is visited a bounded number of times, giving O(V+E) work.
Plate admission also copies bounded records (96 wells, 512 results and at most
eight artifacts per result). Existing fixture values and runtime behavior remain
authoritative; focused tests also verify the contract leaves the input unchanged.

Check the changed example's related record, policy and rendering behavior. Keep real patient records and credentials
in an appropriately governed system; this repository's fixtures support
interaction and implementation exploration.

[Return to the repository guide](../README.md).
