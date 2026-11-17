import { readFileSync } from "node:fs";
import { createSchema } from "graphql-yoga";
import { connection, readId } from "./pagination.mjs";
import { createExampleRepository } from "../data/example-repository.mjs";
import { createScopedRepository } from "../data/scoped-repository.mjs";
import { decidePermission } from "../../shared/permission-scope.mjs";
import { GraphQLError } from "graphql";

const typeDefs = readFileSync(
  new URL("./schema.graphql", import.meta.url),
  "utf8",
);

/** Build private lookup indexes once; request resolvers only read them. */
export function createReadSchema(data) {
  const lanes = [...data.lanes].sort((a, b) => a.order - b.order);
  const cards = [...data.cards].sort((a, b) => a.position - b.position);
  const lanesById = new Map(lanes.map((record) => [record.id, record]));
  const cardsById = new Map(cards.map((record) => [record.id, record]));
  const cardsByLane = new Map(
    lanes.map((lane) => [
      lane.id,
      cards.filter((card) => card.laneId === lane.id),
    ]),
  );
  const example = createExampleRepository(data);
  const requests = new WeakMap();
  const repository = (context) => {
    if (!requests.has(context))
      requests.set(
        context,
        Promise.resolve(context.plateRepository?.() ?? example).then((raw) =>
          createScopedRepository(raw, context.permissionScope, data.ownership),
        ),
      );
    return requests.get(context);
  };
  const relatedResult = async (id, context) =>
    (await repository(context)).getResult(id, { relation: true });
  const corridor = { id: "genomics-workflow", asOf: data.asOf };
  const requireWorkflow = (context) => {
    const scope = context.permissionScope;
    const decision = decidePermission(
      {
        principalId: scope.selection.principalId,
        role: scope.selection.roleId,
        environment: scope.selection.environment,
        action: "resource.read",
      },
      scope.catalog,
    );
    if (!decision.ok)
      throw new GraphQLError("This scenario cannot read the workflow.", {
        extensions: { code: "FORBIDDEN" },
      });
  };
  const page = (records, scope, args, context) =>
    connection(
      records,
      `${context.scopeNamespace}:${scope}`,
      args,
      context.request.signal,
    );

  return createSchema({
    typeDefs,
    resolvers: {
      Query: {
        corridor: (_, __, context) => {
          requireWorkflow(context);
          return corridor;
        },
        dataSource: (_, __, context) => ({
          mode: context.dataMode ?? "EXAMPLE",
        }),
        plate: async (_, { id }, context) => {
          readId(id);
          return (await repository(context)).getPlate(id);
        },
        well: async (_, { plateId, id }, context) => {
          readId(plateId);
          readId(id);
          return (await repository(context)).getWell(plateId, id);
        },
        result: async (_, { id }, context) => {
          readId(id);
          return (await repository(context)).getResult(id);
        },
      },
      Corridor: {
        lanes: (_, args, context) => page(lanes, "lanes", args, context),
        cards: (_, args, context) => {
          const records =
            args.laneId == null
              ? cards
              : (cardsByLane.get(readId(args.laneId)) ?? []);
          return page(records, `cards:${args.laneId ?? "*"}`, args, context);
        },
        connections: (_, args, context) =>
          page(data.connections, "connections", args, context),
      },
      Card: { lane: (card) => lanesById.get(card.laneId) },
      WorkflowLink: {
        from: (link) => cardsById.get(link.fromCardId),
        to: (link) => cardsById.get(link.toCardId),
      },
      Plate: {
        wells: async (plate, args, context) =>
          page(
            await (await repository(context)).listWells(plate.id),
            `wells:${plate.id}`,
            args,
            context,
          ),
      },
      Well: {
        column: (well) => well.col,
        consent: (well) => well.consentStatus ?? null,
        contaminationProbability: (well) => well.contaminationProb,
        corridorCard: (well) => cardsById.get(well.laneCardId) ?? null,
        history: async (well, args, context) =>
          page(
            await (
              await repository(context)
            ).listHistory(well.plateId, well.id),
            `history:${well.plateId}:${well.id}`,
            args,
            context,
          ),
      },
      Result: {
        sequence: (result) => result.seq,
        physicalPlateId: (result) => result.plateId,
        physicalWellId: (result) => result.plateWell,
        supersedes: async (result, _, context) =>
          result.supersedes ? relatedResult(result.supersedes, context) : null,
        artifacts: (result, args, context) =>
          page(
            result.artifacts.map((artifact) => ({
              ...artifact,
              id: `${result.id}:${artifact.key}`,
            })),
            `artifacts:${result.id}`,
            args,
            context,
          ),
      },
      ArtifactReference: {
        file: (reference) => reference,
        reusedFrom: async (reference, _, context) =>
          reference.reusedFrom
            ? relatedResult(reference.reusedFrom, context)
            : null,
        legalHold: (reference) => reference.legalHold ?? false,
      },
      File: { id: (file) => file.key, lifecycleRuleId: (file) => file.ruleId },
    },
  });
}
