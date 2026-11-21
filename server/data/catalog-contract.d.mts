import type { Well, WellResult } from "../../src/app/types";
export type CatalogWell = Well & { id: string; plateId: string; asOf: string };
export type CatalogResult = WellResult & { anchorPlateId: string };
export type CatalogPlate = {
  id: string;
  asOf: string;
  rows: number;
  columns: number;
};
type Read<T> = T | Promise<T>;
/** Scope-neutral, request-owned catalog port. Authorization wraps this receiver. */
export interface CatalogRepository {
  readonly mode: "example" | "stored";
  getPlate(plateId: string): Read<CatalogPlate | null>;
  getWell(plateId: string, wellId: string): Read<CatalogWell | null>;
  listWells(plateId: string): Read<CatalogWell[]>;
  listHistory(plateId: string, wellId: string): Read<CatalogResult[]>;
  getResult(resultId: string): Read<CatalogResult | null>;
}
export const CATALOG_LIMITS: Readonly<{
  wells: number;
  history: number;
  artifacts: number;
}>;
export const CATALOG_PROBES: Readonly<{
  wells: number;
  history: number;
  references: number;
}>;
export function catalogError(
  message: string,
  code?: string,
): Error & { code: string };
export function catalogId(value: unknown, maximum?: number): string;
export function bounded<T>(rows: T[], maximum: number): T[];
