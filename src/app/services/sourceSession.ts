import type { Source } from "../types";
import type {
  CommandPermission,
  CommandRefusal,
  CommandResult,
} from "./command";
import { commandRefusal } from "./command";
import type { PermissionDecision } from "./permissionPolicy";

export const SOURCE_METADATA_LIMITS = {
  title: 180,
  description: 2000,
  tags: 12,
  tag: 40,
} as const;
export type SourceMetadata = Pick<Source, "title" | "description" | "tags">;
export interface SourceEntry {
  readonly record: Source;
  readonly revision: number;
}
export interface SourceSession {
  readonly order: ReadonlyArray<string>;
  readonly byId: Readonly<Record<string, SourceEntry>>;
}
export type SourceCommand =
  | {
      readonly type: "edit";
      readonly id: string;
      readonly revision: number;
      readonly metadata: SourceMetadata;
    }
  | {
      readonly type: "restore";
      readonly id: string;
      readonly revision: number;
    };
type SourceCheck = (
  request: Pick<CommandPermission, "action" | "subjectId">,
) => PermissionDecision;

const own = <T>(
  values: Readonly<Record<string, T>>,
  id: string,
): T | undefined =>
  Object.prototype.hasOwnProperty.call(values, id) ? values[id] : undefined;

export function createSourceSession(
  records: ReadonlyArray<Source>,
): SourceSession {
  return {
    order: records.map((record) => record.id),
    byId: Object.fromEntries(
      records.map((record) => [record.id, { record, revision: 0 }]),
    ),
  };
}

export function selectSources(state: SourceSession): ReadonlyArray<Source> {
  return state.order.map((id) => state.byId[id].record);
}

function validMetadata(input: SourceMetadata): SourceMetadata | undefined {
  if (
    !input ||
    typeof input.title !== "string" ||
    typeof input.description !== "string" ||
    !Array.isArray(input.tags)
  )
    return;
  const title = input.title.trim();
  const description = input.description.trim();
  // Keep accepted text portable to PostgreSQL JSON without replacing visitor text.
  // In Unicode mode a valid surrogate pair is one code point outside this range.
  const unsupportedText = /[\u0000\uD800-\uDFFF]/u;
  if (
    !title ||
    title.length > SOURCE_METADATA_LIMITS.title ||
    !description ||
    description.length > SOURCE_METADATA_LIMITS.description ||
    input.tags.length > SOURCE_METADATA_LIMITS.tags ||
    unsupportedText.test(title) ||
    unsupportedText.test(description)
  )
    return;
  if (
    input.tags.some(
      (tag) =>
        typeof tag !== "string" ||
        !tag.trim() ||
        tag.trim().length > SOURCE_METADATA_LIMITS.tag ||
        unsupportedText.test(tag),
    )
  )
    return;
  return {
    title,
    description,
    tags: [...new Set(input.tags.map((tag) => tag.trim()))],
  };
}

function sameMetadata(left: SourceMetadata, right: SourceMetadata): boolean {
  return (
    left.title === right.title &&
    left.description === right.description &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}

/** Shared preparation leaves authority and acceptance with its receiving owner. */
export function prepareSourceCommand(
  owner: {
    readonly baseline: ReadonlyMap<string, Source>;
    readonly state: SourceSession;
    readonly checkPermission: SourceCheck;
  },
  command: SourceCommand,
): { ok: true; next: SourceSession; changed: boolean } | CommandRefusal {
  if (
    !command ||
    !["edit", "restore"].includes(command.type) ||
    typeof command.id !== "string" ||
    !Number.isSafeInteger(command.revision) ||
    command.revision < 0
  )
    return commandRefusal(
      "invalid",
      "Choose an available source and metadata action.",
    );
  const state = owner.state;
  const entry = own(state.byId, command.id);
  const original = owner.baseline.get(command.id);
  if (!entry || !original)
    return commandRefusal("missing", "This source is no longer available.");
  const permission = owner.checkPermission({
    action: "workspace.edit",
    subjectId: original.id,
  });
  if (!permission.ok) return permission;
  if (entry.revision !== command.revision)
    return commandRefusal(
      "transition",
      "This source changed while you were editing. Cancel and reopen the editor to use its current metadata.",
    );
  const metadata =
    command.type === "restore" ? original : validMetadata(command.metadata);
  if (!metadata)
    return commandRefusal(
      "invalid",
      "Enter a title and summary, with up to 12 tags of 40 characters each.",
    );
  if (sameMetadata(entry.record, metadata))
    return { ok: true, next: state, changed: false };
  const record: Source = {
    ...original,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
  };
  return {
    ok: true,
    changed: true,
    next: {
      ...state,
      byId: {
        ...state.byId,
        [original.id]: { record, revision: entry.revision + 1 },
      },
    },
  };
}

/** Public reference metadata has workspace scope; its provenance is owned by the bundled source. */
export function createSourceCommands(owner: {
  readonly baseline: ReadonlyArray<Source>;
  readonly getState: () => SourceSession;
  readonly commit: (state: SourceSession) => void;
  readonly checkPermission: SourceCheck;
}) {
  const baseline = new Map(owner.baseline.map((record) => [record.id, record]));
  const prepare = (command: SourceCommand) =>
    prepareSourceCommand(
      {
        baseline,
        state: owner.getState(),
        checkPermission: owner.checkPermission,
      },
      command,
    );
  return {
    check(command: SourceCommand): CommandResult {
      const result = prepare(command);
      return result.ok ? { ok: true, changed: result.changed } : result;
    },
    execute(command: SourceCommand): CommandResult {
      const result = prepare(command);
      if (!result.ok) return result;
      if (result.changed) owner.commit(result.next);
      return { ok: true, changed: result.changed };
    },
  };
}
