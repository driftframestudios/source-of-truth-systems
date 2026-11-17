import { createHash } from "node:crypto";
import { buildSchema, printSchema } from "graphql";
import { readOwnedFile } from "./manifest.mjs";
import { createOperationRegistry } from "../../server/graphql/operations.mjs";
import { createWorkspaceOperationRegistry } from "../../server/workspaces/operations.mjs";
export async function graphqlReference(root) {
  const sections = [
    "# GraphQL reference",
    "",
    "This reference is generated from the schemas and registered operations used by the server. The public endpoints accept their registered operation hashes; the local-only explorer retains its existing development boundary.",
    "",
  ];
  for (const [owner, title, endpoint, registry] of [
    [
      "graphql",
      "Plate and Corridor reads",
      "/graphql",
      createOperationRegistry,
    ],
    [
      "workspaces",
      "Disposable Source workspaces",
      "/workspace/graphql",
      createWorkspaceOperationRegistry,
    ],
  ]) {
    const path = `server/${owner}/schema.graphql`,
      source = await readOwnedFile(root, path),
      schema = buildSchema(source),
      operations = registry(schema).operations;
    sections.push(
      `## ${title}`,
      "",
      `Endpoint: \`${endpoint}\`. Source: \`${path}\`.`,
      "",
      "### Schema",
      "",
      "```graphql",
      printSchema(schema),
      "```",
      "",
      "### Approved operations",
      "",
    );
    for (const operation of operations) {
      const source = await readOwnedFile(
        root,
        `server/${owner}/operations/${operation.name}.graphql`,
      );
      if (
        createHash("sha256").update(source).digest("hex") !==
        operation.sha256Hash
      )
        throw new Error("Operation source and registered hash disagree.");
      sections.push(
        `#### ${operation.name}`,
        "",
        `SHA-256: \`${operation.sha256Hash}\``,
        "",
        "```graphql",
        source.trimEnd(),
        "```",
        "",
      );
    }
  }
  sections.push(
    "## Send an approved operation",
    "",
    "Use the hash above with the variables declared by that operation. The request's current scenario and workspace cookie still determine its permission and storage scope. This documentation sends no requests or commands.",
    "",
    "```json",
    JSON.stringify(
      {
        extensions: {
          persistedQuery: { version: 1, sha256Hash: "<registered hash>" },
        },
        variables: {},
      },
      null,
      2,
    ),
    "```",
    "",
  );
  return sections.join("\n");
}
