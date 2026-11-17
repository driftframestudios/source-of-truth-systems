import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Specimen } from "../../types";

export const words = (value: string) => value.replace(/_/g, " ");
export const ASSAY_LABELS: Readonly<Record<string, string>> = {
  wgs: "WGS",
  wes: "WES",
  panel_solid: "Solid panel",
  panel_heme: "Heme panel",
  rna_seq: "RNA-seq",
  methylation: "Methylation",
};
export const TOPICS = {
  context: "Sample context",
  sample: "Sample workflow",
  review: "Clinical review",
  order: "Order workflow",
  quality: "Quality & coverage",
  history: "Recorded history",
  consent: "Consent & provenance",
} as const;
export type SpecimenTopic = keyof typeof TOPICS;
export const COLUMN_SPEC = [
  { id: "identity", label: "Specimen / patient", topic: "context" },
  { id: "assay", label: "Assay / material", topic: "context" },
  { id: "sample", label: "Sample", topic: "sample" },
  { id: "review", label: "Review", topic: "review" },
  { id: "order", label: "Order", topic: "order" },
  { id: "quality", label: "Quality", topic: "quality" },
  { id: "history", label: "History", topic: "history" },
  { id: "consent", label: "Consent / region", topic: "consent" },
] as const;
export type SpecimenColumn = (typeof COLUMN_SPEC)[number]["id"];
export const specimenFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
});
const column = (id: SpecimenColumn) =>
  COLUMN_SPEC.find((item) => item.id === id)!;
const definitions: Array<ColumnDef<typeof specimenFeatures, Specimen>> = [
  {
    id: "identity",
    accessorFn: (row) => row.id,
    filterFn: (row, _id, value: string) => row.original.priority === value,
  },
  {
    id: "assay",
    accessorFn: (row) => ASSAY_LABELS[row.assay] ?? row.assay,
    filterFn: (row, _id, value: string) => row.original.assay === value,
  },
  { id: "sample", accessorFn: (row) => row.sampleState },
  { id: "review", accessorFn: (row) => row.reviewState },
  {
    id: "order",
    accessorFn: (row) => row.orderState,
    filterFn: (row, _id, value: string) => row.original.orderState === value,
  },
  {
    id: "quality",
    accessorFn: (row) => row.qcFlags.length,
    sortFn: (a, b) => a.original.qcFlags.length - b.original.qcFlags.length,
    filterFn: (row, _id, value: string) =>
      value === "flagged"
        ? row.original.qcFlags.length > 0
        : row.original.qcFlags.length === 0,
  },
  {
    id: "history",
    accessorFn: (row) => row.accessionedAt,
    filterFn: (row, _id, value: string) => row.original.stage === value,
  },
  {
    id: "consent",
    accessorFn: (row) => row.consent,
    filterFn: (row, _id, value: string) => row.original.consent === value,
  },
];
export const specimenColumns = definitions.map((definition) => ({
  sortFn: sortFn_alphanumeric,
  sortDescFirst: false,
  enableGlobalFilter: definition.id === "identity",
  ...definition,
  header: column(definition.id as SpecimenColumn).label,
}));

/** Search includes owned display labels and literal record identifiers; it never changes source fields. */
export function specimenSearchText(specimen: Specimen): string {
  return [
    specimen.id,
    specimen.patientCode,
    specimen.indication,
    specimen.specimenType,
    ASSAY_LABELS[specimen.assay],
    specimen.assay,
    specimen.plateWell,
    specimen.geographyCode,
    words(specimen.stage),
    words(specimen.sampleState),
    words(specimen.reviewState),
    words(specimen.orderState),
    specimen.consent,
    ...specimen.qcFlags,
  ]
    .join(" ")
    .toLowerCase();
}

export const FACETS = [
  { column: "assay", label: "Assay", key: "assay" },
  { column: "history", label: "Recorded stage", key: "stage" },
  { column: "consent", label: "Consent", key: "consent" },
  { column: "identity", label: "Priority", key: "priority" },
  { column: "order", label: "Order state", key: "orderState" },
] as const;
