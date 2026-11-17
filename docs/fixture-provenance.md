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

To extend the examples, edit the owning source collection and check its related
record, policy and rendering behavior. Keep real patient records and credentials
in an appropriately governed system; this repository's fixtures support
interaction and implementation exploration.

[Return to the repository guide](../README.md).
