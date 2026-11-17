export const RECORD_SECTIONS = ['sources', 'instructions', 'artifacts', 'comparisons', 'decisions'] as const;
export type RecordSection = (typeof RECORD_SECTIONS)[number];
export type RecordTarget = { [K in RecordSection]: { section: K; entityId: string } }[RecordSection];
export interface RecordRequest { readonly entityId: string; readonly sequence: number }
export interface CorridorOrigin { readonly cardId: string; readonly label: string }
export interface CorridorReference { readonly target: RecordTarget; readonly origin: CorridorOrigin }

function isRecordSection(section: string): section is RecordSection {
  return RECORD_SECTIONS.some((entry) => entry === section);
}

type RecordCollections = Readonly<Record<RecordSection, ReadonlyArray<{ readonly id: string }>>>;

/** Resolve within the named collection; a missing reference never borrows another record. */
export function resolveRecordTarget(target: { section: string; entityId: string }, collections: RecordCollections):
  | { status: 'found'; target: RecordTarget }
  | { status: 'missing'; target: RecordTarget }
  | { status: 'unsupported' } {
  if (!isRecordSection(target.section)) return { status: 'unsupported' };
  const section = target.section;
  const resolved: RecordTarget = { section, entityId: target.entityId };
  return { status: collections[section].some((record) => record.id === target.entityId) ? 'found' : 'missing', target: resolved };
}
