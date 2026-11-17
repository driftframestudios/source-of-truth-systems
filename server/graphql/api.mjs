import { createYoga } from "graphql-yoga";
import { usePersistedOperations } from "@graphql-yoga/plugin-persisted-operations";
import { useRequestDeadline } from "@whatwg-node/server";
import { createReadSchema } from "./schema.mjs";
import { createOperationRegistry } from "./operations.mjs";
import { createCatalogScope } from "../data/provider.mjs";
import { GraphQLError } from "graphql";
import { createHash } from "node:crypto";
import { deriveScenario } from "../../shared/permission-scope.mjs";
import { createRequestAdmission } from "../security/request-admission.mjs";

export const API_LIMITS = Object.freeze({
  bodyBytes: 16_384,
  deadlineMs: 5_000,
});

function rejectedOperation(message, code) {
  return { message, extensions: { code, http: { status: 400 } } };
}

export function createReadApi({
  data,
  explore = false,
  database = { mode: "example" },
  requestAdmission = createRequestAdmission(),
}) {
  const schema = createReadSchema(data);
  const registry = createOperationRegistry(schema);
  const yoga = createYoga({
    schema,
    context: ({ params }) => {
      const parsed = deriveScenario(
        data.permissionCatalog,
        params.extensions?.scenario,
      );
      if (!parsed.ok)
        throw new GraphQLError(parsed.reason, {
          extensions: { code: "SCENARIO_INVALID" },
        });
      return {
        permissionScope: parsed.scope,
        scopeNamespace: createHash("sha256")
          .update(parsed.scope.key)
          .digest("hex"),
      };
    },
    graphqlEndpoint: "/graphql",
    graphiql: explore,
    landingPage: false,
    cors: false,
    batching: false,
    multipart: false,
    maxRequestBodySize: API_LIMITS.bodyBytes,
    maskedErrors: { isDev: false },
    plugins: [
      {
        onRequest({ requestHandler, setRequestHandler }) {
          setRequestHandler(async (request, context, fetchAPI) => {
            const scope = createCatalogScope(database, request.signal);
            try {
              return await requestHandler(
                request,
                {
                  ...context,
                  dataMode: database.mode === "example" ? "EXAMPLE" : "STORED",
                  plateRepository:
                    database.mode === "example"
                      ? undefined
                      : async () => {
                          if (!scope)
                            throw new GraphQLError(
                              "Stored records are unavailable.",
                              { extensions: { code: "DATA_UNAVAILABLE" } },
                            );
                          return scope.repository();
                        },
                },
                fetchAPI,
              );
            } finally {
              await scope?.close();
            }
          });
        },
      },
      requestAdmission,
      useRequestDeadline({
        timeout: API_LIMITS.deadlineMs,
        response: () =>
          Response.json(
            {
              errors: [
                {
                  message: "Request timed out.",
                  extensions: { code: "REQUEST_TIMEOUT" },
                },
              ],
            },
            { status: 504 },
          ),
      }),
      usePersistedOperations({
        getPersistedOperation: (hash) => registry.get(hash),
        allowArbitraryOperations: explore,
        customErrors: {
          notFound: rejectedOperation(
            "Operation is not registered.",
            "PERSISTED_QUERY_NOT_IN_LIST",
          ),
          keyNotFound: rejectedOperation(
            "A registered operation hash is required.",
            "PERSISTED_QUERY_ID_REQUIRED",
          ),
          persistedQueryOnly: rejectedOperation(
            "Send a registered operation hash without a query body.",
            "CANNOT_SEND_PQ_ID_AND_BODY",
          ),
        },
      }),
    ],
  });
  return { yoga, operations: registry.operations };
}
