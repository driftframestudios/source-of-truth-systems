import type { StackLens } from './stackLens';
import type { StackSpacing } from './plateGeometry';
import type { WellResult } from '../../types';

/** View options for the upright result-stack mode of the plate scene. */
export interface PlateStackUi {
  readonly upright: boolean;
  readonly lens: StackLens;
  readonly spacing: StackSpacing;
  readonly spread: 'compact' | 'spacious';
  readonly onlyMulti: boolean;
}

export const DEFAULT_PLATE_UI: PlateStackUi = {
  upright: false,
  lens: 'status',
  spacing: 'ordinal',
  spread: 'compact',
  onlyMulti: false,
};

/** A history-layout control reveals the discs whose arrangement it changes. */
export function historyLayoutPatch(
  layout: Pick<PlateStackUi, 'spacing'> | Pick<PlateStackUi, 'spread'>,
): Partial<PlateStackUi> {
  return { ...layout, upright: true };
}

/** The result whose record is unfurled in the tray. Pinned focus ignores hover. */
export interface StackFocus {
  readonly resultId: string;
  readonly pinned: boolean;
}

/** Result IDs are opaque; the record owns its anchor well. */
export function indexResultWells(stacks: ReadonlyMap<string, ReadonlyArray<WellResult>>): ReadonlyMap<string, string> {
  return new Map([...stacks.values()].flatMap((results) => results.map((result) => [result.id, result.wellId] as const)));
}

export function preferredResult(results: ReadonlyArray<WellResult>): string | null {
  return results.find((result) => result.status === 'reportable')?.id ?? results[0]?.id ?? null;
}
