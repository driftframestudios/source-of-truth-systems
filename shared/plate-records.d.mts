import type { ResultArtifact, Well, WellResult } from "../src/app/types";
export const PLATE_LIMITS: Readonly<{
  wells: number;
  results: number;
  history: number;
  artifacts: number;
  metrics: number;
}>;
export function parseArtifact(value: unknown): ResultArtifact;
export function parseWellResult(value: unknown): WellResult;
export function parseWell(value: unknown): Well & { id?: string };
export function assertPlateCatalog(value: unknown): {
  plateId: string;
  asOf: string;
  wells: (Well & { id?: string })[];
  results: WellResult[];
};
