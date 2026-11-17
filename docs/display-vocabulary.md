# Display vocabulary

Visitors explore **Source of Truth for Life Sciences** through genomic workflows, named source records, and release planning. The Release plan connects delivery requirements, source evidence, review criteria, and deferred work. Its summary is a read-only projection of the current sample plan; publishing remains visibly unavailable.

`src/app/services/cartographyService.ts` owns release, source-role, authority, and reference display helpers. Receivers resolve a record within its named collection before showing its title. Sources and artifacts can share a baseline identifier, so cross-record navigation retains both the section and identifier. The generic lineage helper gives the shared source baseline its source title; it does not choose navigation targets.

| Visitor language | Stable internal representation |
| --- | --- |
| Release plan | `next-arc` route, `generationPacket` |
| Release 01 / 02 / 03 | `arc_01` / `arc_02` / `arc_03` |
| Revision | artifact `pass` |
| Requirements | `instructions` collection and instruction IDs |
| Program context | `loam_context` source role |
| Genomics program brief | `notion_fragment` source ID |

These display changes preserve relationships, access roles, stored records, and routes. Technical terms such as LIMS, AWS Batch, VPC, FASTQ, and ECR remain where they identify the work. Git history retains the retired import material and corridor reference image. Sample descriptions describe genomics delivery and infrastructure; they do not initiate vendor fetches or deployments.

`ShowcaseCredit` supplies the mobile About footer and the planned Welcome footer. It carries the confirmed 2026 copyright holder and creation-tool credit, including the owner-confirmed Claude Opus 5.5 and GPT-6 Astra versions. The repository's MIT license remains unchanged.

Checks cover collection-specific title resolution, a summary derived from the supplied plan, desktop/mobile linked-record return paths, release preview behavior, and mobile About content. Presentations consumes the same release helper in its separately reviewed rendering work.
