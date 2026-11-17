import { createSessionState } from "./browserSession";
import type { SourceEntry } from "./sourceSession";

export interface SourceDraft {
  readonly title: string;
  readonly description: string;
  readonly tags: string;
  readonly revision: number;
  readonly namespace: string;
  readonly error: string;
}
interface EditorState {
  readonly activeId: string | null;
  readonly generation: number;
  readonly drafts: ReadonlyMap<string, SourceDraft>;
  readonly notice: string;
}

/** Drafts stay in this app session, separate from accepted records and shareable navigation. */
export function createSourceEditor() {
  const state = createSessionState<EditorState>({
    activeId: null,
    generation: 0,
    drafts: new Map(),
    notice: "",
  });
  return {
    state,
    open(entry: SourceEntry, namespace: string) {
      state.update((current) => {
        const drafts = new Map(current.drafts);
        if (drafts.get(entry.record.id)?.namespace !== namespace)
          drafts.set(entry.record.id, {
            title: entry.record.title,
            description: entry.record.description,
            tags: entry.record.tags.join(", "),
            revision: entry.revision,
            namespace,
            error: "",
          });
        return {
          ...current,
          activeId: entry.record.id,
          generation: current.generation + 1,
          drafts,
          notice: "",
        };
      });
    },
    hide() {
      state.update((current) => ({
        ...current,
        activeId: null,
        generation: current.generation + 1,
        notice: "",
      }));
    },
    edit(
      id: string,
      generation: number,
      patch: Partial<
        Pick<SourceDraft, "title" | "description" | "tags" | "error">
      >,
    ) {
      state.update((current) => {
        const draft = current.drafts.get(id);
        if (
          !draft ||
          current.activeId !== id ||
          current.generation !== generation
        )
          return current;
        return {
          ...current,
          drafts: new Map(current.drafts).set(id, { ...draft, ...patch }),
        };
      });
    },
    rebase(
      id: string,
      generation: number,
      namespace: string,
      revision: number,
    ) {
      state.update((current) => {
        const draft = current.drafts.get(id);
        if (
          !draft ||
          current.activeId !== id ||
          current.generation !== generation ||
          draft.namespace === namespace
        )
          return current;
        return {
          ...current,
          drafts: new Map(current.drafts).set(id, {
            ...draft,
            namespace,
            revision,
          }),
        };
      });
    },
    finish(id: string, generation: number, notice = "") {
      state.update((current) => {
        if (current.generation !== generation) return current;
        const drafts = new Map(current.drafts);
        drafts.delete(id);
        return {
          ...current,
          activeId: null,
          generation: current.generation + 1,
          drafts,
          notice,
        };
      });
    },
    notify(generation: number, notice: string) {
      state.update((current) =>
        current.generation === generation ? { ...current, notice } : current,
      );
    },
  };
}
