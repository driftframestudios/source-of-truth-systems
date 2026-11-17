import type { Biomarker, Specimen } from "../types";
import { ORDER_FLOW, REVIEW_FLOW } from "../types";
import { meetsAllSpecimenTargets } from "./specimenQuality";

export type Facet =
  | "assay"
  | "priority"
  | "stage"
  | "consent"
  | "dataClass"
  | "geography"
  | "tumorPercent"
  | "coverageMet"
  | "qcFlagged"
  | "variantsCalled"
  | "biomarkerCategory"
  | "biomarkerTier"
  | "orderState"
  | "biomarkerReview";
export type Joiner = "AND" | "OR";
export interface PredicateNode {
  readonly kind: "predicate";
  readonly id: string;
  readonly facet: Facet;
  readonly value: string;
  readonly negated: boolean;
}
export interface GroupNode {
  readonly kind: "group";
  readonly id: string;
  readonly joiner: Joiner;
  readonly negated: boolean;
  readonly label: string;
  readonly children: ReadonlyArray<RuleNode>;
}
export type RuleNode = PredicateNode | GroupNode;
export interface RuleDefinition {
  readonly name: string;
  readonly root: GroupNode;
}
export type FacetOptions = Readonly<Record<Facet, ReadonlyArray<string>>>;
export const COHORT_LIMITS = {
  name: 120,
  label: 100,
  id: 100,
  nodes: 128,
  depth: 8,
} as const;

/** Bound a candidate before recursive rendering, counting or expression building. */
export function withinCohortDraftLimits(root: RuleNode): boolean {
  const pending = [{ node: root, depth: 0 }];
  const seen = new Set<RuleNode>();
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (seen.has(node) || seen.size >= COHORT_LIMITS.nodes || depth > COHORT_LIMITS.depth) return false;
    seen.add(node);
    if (node.kind === 'group') {
      if (node.children.length + seen.size + pending.length > COHORT_LIMITS.nodes) return false;
      for (const child of node.children) pending.push({ node: child, depth: depth + 1 });
    }
  }
  return true;
}

export function cohortFacetOptions(
  specimens: ReadonlyArray<Specimen>,
): FacetOptions {
  const unique = (values: ReadonlyArray<string>) => [...new Set(values)];
  return {
    assay: unique(specimens.map((s) => s.assay)),
    priority: ["stat", "expedited", "routine"],
    stage: unique(specimens.map((s) => s.stage)),
    consent: ["active", "pending", "rescinded", "expired"],
    dataClass: ["synthetic", "de_identified", "limited", "phi"],
    geography: unique(specimens.map((s) => s.geographyCode)),
    tumorPercent: ["20", "30", "50", "70"],
    coverageMet: ["true"],
    qcFlagged: ["true"],
    variantsCalled: ["50", "200", "1000", "5000"],
    biomarkerCategory: [
      "somatic",
      "germline",
      "signature",
      "expression",
      "pgx",
    ],
    biomarkerTier: ["tier_1", "tier_2", "tier_3", "tier_4"],
    orderState: ORDER_FLOW,
    biomarkerReview: REVIEW_FLOW,
  };
}

/** Accept a bounded definition and copy only its owned fields into session state. */
export function parseRuleDefinition(
  input: unknown,
  options: FacetOptions,
): RuleDefinition | undefined {
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const text = (value: unknown, max: number): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!object(input) || !text(input.name, COHORT_LIMITS.name)) return;
  const ids = new Set<string>();
  let count = 0;
  function visit(value: unknown, depth: number): RuleNode | undefined {
    if (
      !object(value) ||
      ++count > COHORT_LIMITS.nodes ||
      depth > COHORT_LIMITS.depth ||
      !text(value.id, COHORT_LIMITS.id) ||
      ids.has(value.id) ||
      typeof value.negated !== "boolean"
    )
      return;
    ids.add(value.id);
    const common = { id: value.id, negated: value.negated };
    if (value.kind === "predicate") {
      if (
        typeof value.facet !== "string" ||
        !Object.prototype.hasOwnProperty.call(options, value.facet) ||
        typeof value.value !== "string" ||
        !options[value.facet as Facet].includes(value.value)
      )
        return;
      return {
        ...common,
        kind: "predicate",
        facet: value.facet as Facet,
        value: value.value,
      };
    }
    if (
      value.kind !== "group" ||
      (value.joiner !== "AND" && value.joiner !== "OR") ||
      !text(value.label, COHORT_LIMITS.label) ||
      !Array.isArray(value.children) ||
      value.children.length > COHORT_LIMITS.nodes
    )
      return;
    const children: RuleNode[] = [];
    for (const child of value.children) {
      const accepted = visit(child, depth + 1);
      if (!accepted) return;
      children.push(accepted);
    }
    return {
      ...common,
      kind: "group",
      joiner: value.joiner as Joiner,
      label: value.label.trim(),
      children,
    };
  }
  const root = visit(input.root, 0);
  return root?.kind === "group" ? { name: input.name.trim(), root } : undefined;
}

/** One projection per accepted record snapshot; rule definitions never cache a result count. */
export function createCohortProjection(
  specimens: ReadonlyArray<Specimen>,
  biomarkers: ReadonlyArray<Biomarker>,
) {
  const bySpecimen = new Map<string, Biomarker[]>();
  for (const biomarker of biomarkers) {
    const linked = bySpecimen.get(biomarker.specimenId) ?? [];
    linked.push(biomarker);
    bySpecimen.set(biomarker.specimenId, linked);
  }
  const biomarkersFor = (id: string): ReadonlyArray<Biomarker> =>
    bySpecimen.get(id) ?? [];
  const tests: Record<Facet, (specimen: Specimen, value: string) => boolean> = {
    assay: (s, v) => s.assay === v,
    priority: (s, v) => s.priority === v,
    stage: (s, v) => s.stage === v,
    consent: (s, v) => s.consent === v,
    dataClass: (s, v) => s.dataClass === v,
    geography: (s, v) => s.geographyCode === v,
    tumorPercent: (s, v) => (s.tumorPercent ?? -1) >= Number(v),
    coverageMet: (s) => meetsAllSpecimenTargets(s.coverage),
    qcFlagged: (s) => s.qcFlags.length > 0,
    variantsCalled: (s, v) => (s.variantsCalled ?? -1) >= Number(v),
    biomarkerCategory: (s, v) =>
      biomarkersFor(s.id).some((b) => b.category === v),
    biomarkerTier: (s, v) =>
      biomarkersFor(s.id).some((b) => b.actionability === v),
    orderState: (s, v) => s.orderState === v,
    biomarkerReview: (s, v) =>
      biomarkersFor(s.id).some((b) => b.reviewState === v),
  };
  const matchesFacet = (facet: Facet, value: string, specimen: Specimen) =>
    tests[facet](specimen, value);
  function evaluate(node: RuleNode, specimen: Specimen): boolean {
    const result =
      node.kind === "predicate"
        ? matchesFacet(node.facet, node.value, specimen)
        : node.children.length === 0
          ? true
          : node.joiner === "AND"
            ? node.children.every((child) => evaluate(child, specimen))
            : node.children.some((child) => evaluate(child, specimen));
    return node.negated ? !result : result;
  }
  return {
    biomarkersFor,
    countFacet: (facet: Facet, value: string) =>
      specimens.filter((s) => matchesFacet(facet, value, s)).length,
    count: (node: RuleNode) =>
      specimens.filter((s) => evaluate(node, s)).length,
    match(node: RuleNode) {
      const matched = specimens.filter((s) => evaluate(node, s));
      const eligible = matched.filter((s) => s.consent === "active");
      const held = matched.filter((s) => s.consent !== "active");
      return { matched, eligible, held };
    },
  };
}
