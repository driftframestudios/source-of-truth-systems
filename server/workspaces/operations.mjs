import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parse, validate } from "graphql";

const OPERATIONS = Object.freeze({
  WorkspaceStatus: "query",
  WorkspaceSnapshot: "query",
  WorkspaceSource: "query",
  WorkspaceHistory: "query",
  StartWorkspace: "mutation",
  ResetWorkspace: "mutation",
  SaveSource: "mutation",
  RestoreSource: "mutation",
});

/** The workspace endpoint admits only these reviewed operation documents. */
export function createWorkspaceOperationRegistry(schema) {
  const documents = new Map();
  const descriptors = [];
  for (const [name, kind] of Object.entries(OPERATIONS)) {
    const source = readFileSync(
      new URL(`./operations/${name}.graphql`, import.meta.url),
      "utf8",
    );
    const document = parse(source);
    const operations = document.definitions.filter(
      (definition) => definition.kind === "OperationDefinition",
    );
    const errors = validate(schema, document);
    if (
      operations.length !== 1 ||
      operations[0].name?.value !== name ||
      operations[0].operation !== kind ||
      errors.length
    ) {
      throw new Error(
        `Workspace operation ${name} must contain its one valid named ${kind}.`,
      );
    }
    const hash = createHash("sha256").update(source).digest("hex");
    documents.set(hash, document);
    descriptors.push(Object.freeze({ name, sha256Hash: hash }));
  }
  return Object.freeze({
    operations: Object.freeze(descriptors),
    get: (hash) => documents.get(hash) ?? null,
  });
}
