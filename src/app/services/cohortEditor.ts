import { withinCohortDraftLimits } from "./cohortRules";
import type { GroupNode, Joiner, RuleNode } from "./cohortRules";

export interface CohortEditorState {
  readonly root: GroupNode;
  readonly focusId: string;
  readonly selected: ReadonlySet<string>;
  readonly issue: "limit" | "siblings" | null;
}
export type CohortEditorAction =
  | { type: "open"; root: GroupNode }
  | { type: "focus" | "select" | "remove" | "unlink"; id: string }
  | { type: "update"; id: string; update: (node: RuleNode) => RuleNode }
  | { type: "add"; id: string; node: RuleNode }
  | { type: "link"; id: string; joiner: Joiner; label: string }
  | { type: "clearIssue" };

type Entry = { node: RuleNode; parent: GroupNode | null };
function indexTree(root: GroupNode): Map<string, Entry> {
  const index = new Map<string, Entry>();
  const walk = (node: RuleNode, parent: GroupNode | null) => {
    index.set(node.id, { node, parent });
    if (node.kind === "group")
      node.children.forEach((child) => walk(child, node));
  };
  walk(root, null);
  return index;
}

/** Copy the changed path, retaining untouched branches and no-op identity. */
function replaceNode(
  node: RuleNode,
  id: string,
  update: (node: RuleNode) => RuleNode,
): RuleNode {
  if (node.id === id) return update(node);
  if (node.kind === "predicate") return node;
  const children = node.children.map((child) => replaceNode(child, id, update));
  return children.every((child, i) => child === node.children[i])
    ? node
    : { ...node, children };
}

export function createCohortEditor(root: GroupNode): CohortEditorState {
  if (!withinCohortDraftLimits(root))
    throw new Error("Cohort draft exceeds its tree bounds.");
  return { root, focusId: root.id, selected: new Set(), issue: null };
}

/** One admitted transition owns tree, focus and selection; accepted rules remain session-owned. */
export function cohortEditorReducer(
  state: CohortEditorState,
  action: CohortEditorAction,
): CohortEditorState {
  if (action.type === "clearIssue")
    return state.issue ? { ...state, issue: null } : state;
  if (action.type === "open") {
    return withinCohortDraftLimits(action.root)
      ? createCohortEditor(action.root)
      : { ...state, issue: "limit" };
  }
  const before = indexTree(state.root);
  const entry = before.get(action.id);
  if (action.type === "focus") {
    return entry?.node.kind === "group" && state.focusId !== action.id
      ? { ...state, focusId: action.id }
      : state;
  }
  if (action.type === "select") {
    if (!entry?.parent) return state;
    const selected = new Set(state.selected);
    if (selected.has(action.id)) selected.delete(action.id);
    else selected.add(action.id);
    return { ...state, selected };
  }

  let candidate: RuleNode = state.root;
  let selected = state.selected;
  switch (action.type) {
    case "update":
      candidate = replaceNode(state.root, action.id, action.update);
      break;
    case "add":
      if (entry?.node.kind !== "group") return state;
      candidate = replaceNode(state.root, action.id, (node) => ({
        ...(entry.node as GroupNode),
        children: [...(node as GroupNode).children, action.node],
      }));
      break;
    case "remove":
    case "unlink": {
      if (
        !entry?.parent ||
        (action.type === "unlink" && entry.node.kind !== "group")
      )
        return state;
      const children = entry.parent.children.flatMap((child) =>
        child.id !== action.id
          ? [child]
          : action.type === "unlink" && child.kind === "group"
            ? child.children
            : [],
      );
      candidate = replaceNode(state.root, entry.parent.id, (node) => ({
        ...(node as GroupNode),
        children,
      }));
      break;
    }
    case "link": {
      if (selected.size < 2) return state;
      const ids = [...selected];
      const parent = before.get(ids[0])?.parent;
      if (!parent || ids.some((id) => before.get(id)?.parent !== parent))
        return { ...state, issue: "siblings" };
      const children: RuleNode[] = [];
      const group: GroupNode = {
        kind: "group",
        id: action.id,
        joiner: action.joiner,
        label: action.label,
        negated: false,
        children: parent.children.filter((child) => selected.has(child.id)),
      };
      for (const child of parent.children) {
        if (!selected.has(child.id)) children.push(child);
        else if (child === group.children[0]) children.push(group);
      }
      candidate = replaceNode(state.root, parent.id, (node) => ({
        ...(node as GroupNode),
        children,
      }));
      selected = new Set();
      break;
    }
  }
  // Bound before indexing or rendering the new tree. Labels remain editable until Save.
  if (candidate.kind !== "group" || !withinCohortDraftLimits(candidate))
    return { ...state, issue: "limit" };
  if (candidate === state.root) return state;
  const after = indexTree(candidate);
  let focusId = state.focusId;
  while (after.get(focusId)?.node.kind !== "group") {
    const parent = before.get(focusId)?.parent;
    if (!parent) {
      focusId = candidate.id;
      break;
    }
    focusId = parent.id;
  }
  const surviving = [...selected].filter((id) => after.get(id)?.parent);
  if (surviving.length !== selected.size) selected = new Set(surviving);
  return { root: candidate, focusId, selected, issue: null };
}
