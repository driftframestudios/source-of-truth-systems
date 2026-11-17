import type { SpecimenCoverageBar } from "../types";

type TargetMetric = Pick<
  SpecimenCoverageBar,
  "value" | "target" | "comparator"
>;

const TARGET_RULES = {
  gte: {
    qualifier: "at least",
    meets: (value: number, target: number) => value >= target,
  },
  lte: {
    qualifier: "at most",
    meets: (value: number, target: number) => value <= target,
  },
} as const;

/** The source declares the comparison; metric names never imply a clinical rule. */
export function meetsSpecimenTarget(metric: TargetMetric): boolean {
  return TARGET_RULES[metric.comparator].meets(metric.value, metric.target);
}

export function specimenTargetLabel(
  metric: Pick<SpecimenCoverageBar, "target" | "unit" | "comparator">,
): string {
  return `Target ${TARGET_RULES[metric.comparator].qualifier} ${metric.target}${metric.unit ?? ""}`;
}

export function meetsAllSpecimenTargets(
  metrics: ReadonlyArray<TargetMetric>,
): boolean {
  return metrics.length > 0 && metrics.every(meetsSpecimenTarget);
}
