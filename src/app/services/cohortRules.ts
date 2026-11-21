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
    if (
      seen.has(node) ||
      seen.size >= COHORT_LIMITS.nodes ||
      depth > COHORT_LIMITS.depth
    )
      return false;
    seen.add(node);
    if (node.kind === "group") {
      if (
        node.children.length + seen.size + pending.length >
        COHORT_LIMITS.nodes
      )
        return false;
      for (const child of node.children)
        pending.push({ node: child, depth: depth + 1 });
    }
  }
  return true;
}

type FacetContext = { biomarkersFor: (id: string) => ReadonlyArray<Biomarker> };
type FacetDefinition = {
  readonly label: string;
  readonly options: (
    specimens: ReadonlyArray<Specimen>,
  ) => ReadonlyArray<string>;
  readonly test: (
    specimen: Specimen,
    value: string,
    context: FacetContext,
  ) => boolean;
} & (
  | { readonly mode: "enum" | "bool"; readonly unit?: never }
  | { readonly mode: "gte"; readonly unit?: string }
);
const unique = (values: ReadonlyArray<string>) => [...new Set(values)];

/** Semantic strategies; rendering owns icons, color and placement. Wire values remain strings. */
export const COHORT_FACETS = {
  assay: {
    label: "Assay",
    mode: "enum",
    options: (s) => unique(s.map((x) => x.assay)),
    test: (s, v) => s.assay === v,
  },
  priority: {
    label: "Priority",
    mode: "enum",
    options: () => ["stat", "expedited", "routine"],
    test: (s, v) => s.priority === v,
  },
  stage: {
    label: "Pipeline stage",
    mode: "enum",
    options: (s) => unique(s.map((x) => x.stage)),
    test: (s, v) => s.stage === v,
  },
  consent: {
    label: "Consent",
    mode: "enum",
    options: () => ["active", "pending", "rescinded", "expired"],
    test: (s, v) => s.consent === v,
  },
  dataClass: {
    label: "Data class",
    mode: "enum",
    options: () => ["synthetic", "de_identified", "limited", "phi"],
    test: (s, v) => s.dataClass === v,
  },
  geography: {
    label: "Geography",
    mode: "enum",
    options: (s) => unique(s.map((x) => x.geographyCode)),
    test: (s, v) => s.geographyCode === v,
  },
  tumorPercent: {
    label: "Tumor content ≥",
    mode: "gte",
    unit: "%",
    options: () => ["20", "30", "50", "70"],
    test: (s, v) => (s.tumorPercent ?? -1) >= Number(v),
  },
  coverageMet: {
    label: "All metric targets met",
    mode: "bool",
    options: () => ["true"],
    test: (s) => meetsAllSpecimenTargets(s.coverage),
  },
  qcFlagged: {
    label: "Has QC flag",
    mode: "bool",
    options: () => ["true"],
    test: (s) => s.qcFlags.length > 0,
  },
  variantsCalled: {
    label: "Variants called ≥",
    mode: "gte",
    options: () => ["50", "200", "1000", "5000"],
    test: (s, v) => (s.variantsCalled ?? -1) >= Number(v),
  },
  biomarkerCategory: {
    label: "Biomarker class",
    mode: "enum",
    options: () => ["somatic", "germline", "signature", "expression", "pgx"],
    test: (s, v, c) => c.biomarkersFor(s.id).some((b) => b.category === v),
  },
  biomarkerTier: {
    label: "Actionability tier",
    mode: "enum",
    options: () => ["tier_1", "tier_2", "tier_3", "tier_4"],
    test: (s, v, c) => c.biomarkersFor(s.id).some((b) => b.actionability === v),
  },
  orderState: {
    label: "Order workflow",
    mode: "enum",
    options: () => ORDER_FLOW,
    test: (s, v) => s.orderState === v,
  },
  biomarkerReview: {
    label: "Biomarker review",
    mode: "enum",
    options: () => REVIEW_FLOW,
    test: (s, v, c) => c.biomarkersFor(s.id).some((b) => b.reviewState === v),
  },
} satisfies Record<Facet, FacetDefinition>;
export const COHORT_FACET_IDS = Object.keys(COHORT_FACETS) as Facet[];
export const cohortFacet = (id: Facet): FacetDefinition => COHORT_FACETS[id];
export function cohortFacetOptions(
  specimens: ReadonlyArray<Specimen>,
): FacetOptions {
  return Object.fromEntries(
    COHORT_FACET_IDS.map((id) => [id, cohortFacet(id).options(specimens)]),
  ) as FacetOptions;
}

/** Functional visitors receive admitted trees; evaluation separately retains short circuiting. */
export function foldRule<T>(
  node: RuleNode,
  visitor: {
    predicate: (node: PredicateNode) => T;
    group: (node: GroupNode, children: T[]) => T;
  },
): T {
  return node.kind === "predicate"
    ? visitor.predicate(node)
    : visitor.group(
        node,
        node.children.map((child) => foldRule(child, visitor)),
      );
}
export const countPredicates = (node: RuleNode) =>
  foldRule(node, {
    predicate: () => 1,
    group: (_, children: number[]) => children.reduce((a, b) => a + b, 0),
  });
export function predicateText(node: PredicateNode): string {
  const f = cohortFacet(node.facet);
  return f.mode === "bool"
    ? f.label
    : f.mode === "gte"
      ? `${f.label} ${node.value}${f.unit ?? ""}`
      : `${f.label} = ${node.value.replace(/_/g, " ")}`;
}
export function toExpression(node: RuleNode, depth = 0): string {
  const inner =
    node.kind === "predicate"
      ? `${node.facet}${cohortFacet(node.facet).mode === "gte" ? ">=" : "="}${node.value}`
      : node.children.length === 0
        ? "TRUE"
        : node.children
            .map((c) => toExpression(c, depth + 1))
            .join(` ${node.joiner} `);
  const wrapped =
    node.kind === "group" && depth > 0 && node.children.length > 1
      ? `(${inner})`
      : inner;
  return node.negated
    ? `NOT ${node.kind === "group" && node.children.length > 1 && depth === 0 ? `(${wrapped})` : wrapped}`
    : wrapped;
}
export const emptyRuleText = (node: GroupNode) =>
  node.negated
    ? "Empty negated group — no specimens match"
    : "Empty — all specimens match";

export function createRuleFactory(allocateId: (kind: "p" | "g") => string) {
  return {
    predicate: (
      facet: Facet,
      value: string,
      negated = false,
    ): PredicateNode => ({
      kind: "predicate",
      id: allocateId("p"),
      facet,
      value,
      negated,
    }),
    group: (
      children: ReadonlyArray<RuleNode>,
      joiner: Joiner = "AND",
      label = "Cohort root",
      id = allocateId("g"),
    ): GroupNode => ({
      kind: "group",
      id,
      joiner,
      label,
      negated: false,
      children,
    }),
    id: allocateId,
  };
}
export function createCohortPresets(
  factory: ReturnType<typeof createRuleFactory>,
) {
  const { predicate: p, group: g } = factory;
  // Each load allocates fresh descendant identities; root remains the editor's conventional root.
  return [
    {
      id: "tb",
      label: "Tumor-board ready",
      build: () =>
        g(
          [
            g(
              [
                p("biomarkerTier", "tier_1"),
                p("biomarkerCategory", "signature"),
              ],
              "OR",
              "Actionable signal",
            ),
            p("coverageMet", "true"),
            p("consent", "rescinded", true),
          ],
          "AND",
          "Cohort root",
          "root",
        ),
    },
    {
      id: "reseq",
      label: "Re-sequence candidates",
      build: () =>
        g(
          [
            g(
              [p("qcFlagged", "true"), p("coverageMet", "true", true)],
              "OR",
              "QC concern",
            ),
            p("consent", "active"),
          ],
          "AND",
          "Cohort root",
          "root",
        ),
    },
    {
      id: "gov",
      label: "Governance holds",
      build: () =>
        g(
          [
            p("consent", "rescinded"),
            p("consent", "pending"),
            p("consent", "expired"),
          ],
          "OR",
          "Cohort root",
          "root",
        ),
    },
  ];
}

export interface RuleFinding {
  readonly code:
    "name" | "limit" | "node" | "duplicate-id" | "facet-value" | "group";
  readonly path: ReadonlyArray<number>;
  readonly nodeId?: string;
}
export function parseRuleDefinition(
  input: unknown,
  options: FacetOptions,
): RuleDefinition | undefined {
  return inspectRuleDefinition(input, options).definition;
}

/** Accept a bounded definition and copy only its owned fields into session state. */
export function inspectRuleDefinition(
  input: unknown,
  options: FacetOptions,
): { definition?: RuleDefinition; finding?: RuleFinding } {
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const text = (value: unknown, max: number): value is string =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max;
  if (!object(input) || !text(input.name, COHORT_LIMITS.name))
    return { finding: { code: "name", path: [] } };
  let finding: RuleFinding | undefined;
  const fail = (
    code: RuleFinding["code"],
    path: number[],
    value?: Record<string, unknown>,
  ) => {
    finding ??= {
      code,
      path,
      ...(text(value?.id, COHORT_LIMITS.id)
        ? { nodeId: value!.id as string }
        : {}),
    };
    return undefined;
  };
  const ids = new Set<string>();
  let count = 0;
  function visit(
    value: unknown,
    depth: number,
    path: number[],
  ): RuleNode | undefined {
    if (++count > COHORT_LIMITS.nodes || depth > COHORT_LIMITS.depth)
      return fail("limit", path);
    if (
      !object(value) ||
      !text(value.id, COHORT_LIMITS.id) ||
      typeof value.negated !== "boolean"
    )
      return fail("node", path);
    if (ids.has(value.id)) return fail("duplicate-id", path, value);
    ids.add(value.id);
    const common = { id: value.id, negated: value.negated };
    if (value.kind === "predicate") {
      if (
        typeof value.facet !== "string" ||
        !Object.prototype.hasOwnProperty.call(options, value.facet) ||
        typeof value.value !== "string" ||
        !options[value.facet as Facet].includes(value.value)
      )
        return fail("facet-value", path, value);
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
      return fail("group", path, value);
    const children: RuleNode[] = [];
    for (const [index, child] of value.children.entries()) {
      const accepted = visit(child, depth + 1, [...path, index]);
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
  const root = visit(input.root, 0, []);
  return root?.kind === "group"
    ? { definition: { name: input.name.trim(), root } }
    : { finding: finding ?? { code: "group", path: [] } };
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
  const context = { biomarkersFor };
  const matchesFacet = (facet: Facet, value: string, specimen: Specimen) =>
    cohortFacet(facet).test(specimen, value, context);
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
  type Matches = {
    matched: Specimen[];
    eligible: Specimen[];
    held: Specimen[];
  };
  type Analysis = Matches & {
    counts: ReadonlyMap<string, number>;
    predicates: number;
    expression: string;
  };
  type Summary = { eligible: number; held: number; expression: string };
  // Weak keys follow admitted immutable trees. Removed drafts/saved rules can be collected.
  const analyses = new WeakMap<RuleNode, Analysis>();
  const summaries = new WeakMap<RuleNode, Summary>();
  const facetCounts = new Map<Facet, Map<string, number>>();
  const options = cohortFacetOptions(specimens);
  function analyze(root: RuleNode): Analysis {
    const previous = analyses.get(root);
    if (previous) return previous;
    const counts = new Map<string, number>();
    const result: Analysis = {
      counts,
      matched: [],
      eligible: [],
      held: [],
      predicates: countPredicates(root),
      expression: toExpression(root),
    };
    function visit(node: RuleNode, specimen: Specimen): boolean {
      let value: boolean;
      if (node.kind === "predicate")
        value = matchesFacet(node.facet, node.value, specimen);
      else {
        value = node.children.length === 0 || node.joiner === "AND";
        // Every child contributes its own count, even after its parent result is known.
        for (const child of node.children) {
          const childValue = visit(child, specimen);
          value =
            node.joiner === "AND" ? value && childValue : value || childValue;
        }
      }
      if (node.negated) value = !value;
      counts.set(node.id, (counts.get(node.id) ?? 0) + Number(value));
      return value;
    }
    for (const specimen of specimens)
      if (visit(root, specimen)) {
        result.matched.push(specimen);
        (specimen.consent === "active" ? result.eligible : result.held).push(
          specimen,
        );
      }
    analyses.set(root, result);
    return result;
  }
  function summary(root: RuleNode): Summary {
    const previous = summaries.get(root);
    if (previous) return previous;
    let eligible = 0,
      held = 0;
    for (const specimen of specimens)
      if (evaluate(root, specimen)) {
        if (specimen.consent === "active") eligible++;
        else held++;
      }
    const result = { eligible, held, expression: toExpression(root) };
    summaries.set(root, result);
    return result;
  }
  return {
    biomarkersFor,
    analyze,
    summary,
    countFacet(facet: Facet, value: string) {
      const cached = facetCounts.get(facet)?.get(value);
      if (cached !== undefined) return cached;
      let count = 0;
      for (const specimen of specimens)
        if (matchesFacet(facet, value, specimen)) count++;
      // Admitted options bound cache cardinality; custom callers retain ordinary evaluation.
      if (options[facet].includes(value)) {
        let entries = facetCounts.get(facet);
        if (!entries) facetCounts.set(facet, (entries = new Map()));
        entries.set(value, count);
      }
      return count;
    },
    count(node: RuleNode) {
      let count = 0;
      for (const specimen of specimens) if (evaluate(node, specimen)) count++;
      return count;
    },
    match(node: RuleNode): Matches {
      const result: Matches = { matched: [], eligible: [], held: [] };
      for (const specimen of specimens)
        if (evaluate(node, specimen)) {
          result.matched.push(specimen);
          (specimen.consent === "active" ? result.eligible : result.held).push(
            specimen,
          );
        }
      return result;
    },
  };
}
