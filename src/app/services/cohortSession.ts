import type { CommandPermission, CommandRefusal } from "./command";
import { commandRefusal } from "./command";
import type { PermissionDecision } from "./permissionPolicy";
import type { FacetOptions, RuleDefinition } from "./cohortRules";
import { parseRuleDefinition } from "./cohortRules";

export interface SavedCohortRule extends RuleDefinition {
  readonly id: string;
  readonly revision: number;
}
export interface CohortSession {
  readonly rules: ReadonlyArray<SavedCohortRule>;
}
export type CohortCommand =
  | { readonly type: "create"; readonly definition: RuleDefinition }
  | {
      readonly type: "update";
      readonly id: string;
      readonly revision: number;
      readonly definition: RuleDefinition;
    }
  | { readonly type: "remove"; readonly id: string; readonly revision: number };
export type CohortResult =
  | { readonly ok: true; readonly id: string; readonly revision: number }
  | CommandRefusal;

export function createCohortCommands(owner: {
  readonly getState: () => CohortSession;
  readonly commit: (state: CohortSession) => void;
  readonly options: FacetOptions;
  readonly newId: () => string;
  readonly checkPermission: (
    request: Pick<CommandPermission, "action" | "subjectId">,
  ) => PermissionDecision;
}) {
  return {
    execute(command: CohortCommand): CohortResult {
      if (!command || !["create", "update", "remove"].includes(command.type))
        return commandRefusal("invalid", "Choose a rule action.");
      const state = owner.getState();
      const entry =
        command.type === "create"
          ? undefined
          : state.rules.find((rule) => rule.id === command.id);
      if (command.type !== "create" && !entry)
        return commandRefusal(
          "missing",
          "This saved rule is no longer available. Save a copy to keep your draft.",
        );
      const permission = owner.checkPermission({
        action: "workspace.edit",
        subjectId: entry?.id ?? "cohort-rules",
      });
      if (!permission.ok) return permission;
      if (
        command.type !== "create" &&
        (!Number.isSafeInteger(command.revision) ||
          command.revision !== entry!.revision)
      )
        return commandRefusal(
          "transition",
          "This rule changed. Reopen its saved version, or save a copy of your draft.",
        );
      if (command.type === "remove") {
        owner.commit({
          rules: state.rules.filter((rule) => rule.id !== entry!.id),
        });
        return { ok: true, id: entry!.id, revision: entry!.revision };
      }
      const definition = parseRuleDefinition(command.definition, owner.options);
      if (!definition)
        return commandRefusal(
          "invalid",
          "Enter a rule name and use valid facet values in labeled groups (up to 128 cards and 8 nested levels).",
        );
      const accepted: SavedCohortRule = {
        ...definition,
        id: entry?.id ?? owner.newId(),
        revision: (entry?.revision ?? -1) + 1,
      };
      owner.commit({
        rules: entry
          ? state.rules.map((rule) => (rule.id === entry.id ? accepted : rule))
          : [accepted, ...state.rules],
      });
      return { ok: true, id: accepted.id, revision: accepted.revision };
    },
  };
}
