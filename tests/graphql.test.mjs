import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { exampleData } from "../build/server/example-data.mjs";
import { createReadApi, API_LIMITS } from "../server/graphql/api.mjs";
import { runningServer } from "./server-fixture.mjs";
import { PLATE_HISTORY_HASH } from "../shared/plate-history-operation.mjs";

const { operations } = createReadApi({ data: exampleData });
const byName = new Map(
  operations.map((operation) => [operation.name, operation.sha256Hash]),
);
const plateId = "NVSX-2026-118";
function envelope(name, variables = {}) {
  assert.ok(byName.has(name), `Registered operation ${name}`);
  return {
    extensions: {
      persistedQuery: { version: 1, sha256Hash: byName.get(name) },
    },
    variables,
  };
}
async function post(base, body) {
  const response = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}
async function read(base, name, variables) {
  const { response, body } = await post(base, envelope(name, variables));
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.errors, undefined, JSON.stringify(body));
  return body.data;
}

test("owned queries validate and HTTP reads preserve corridor links and ordered plate paging", async (t) => {
  assert.equal(
    byName.get("PlateHistory"),
    PLATE_HISTORY_HASH,
    "Browser hash identifies the deployed reviewed document",
  );
  const base = await runningServer(t);
  const overview = await read(base, "CorridorOverview");
  assert.equal(overview.corridor.lanes.totalCount, 11);
  assert.equal(overview.corridor.lanes.edges[0].node.id, "lane_accession");
  const cards = await read(base, "CorridorCards", { laneId: "lane_accession" });
  assert.ok(cards.corridor.cards.edges.length > 0);
  assert.ok(
    cards.corridor.cards.edges.every(
      ({ node }) => node.lane.id === "lane_accession",
    ),
  );
  const links = await read(base, "CorridorConnections", { first: 50 });
  assert.ok(links.corridor.connections.edges.length > 0);
  assert.ok(
    links.corridor.connections.edges.every(
      ({ node }) => node.from.id && node.to.id,
    ),
  );
  const first = (await read(base, "PlateOverview", { id: plateId, first: 2 }))
    .plate;
  assert.equal(first.wells.totalCount, 96);
  assert.deepEqual(
    first.wells.edges.map(({ node }) => node.id),
    ["A1", "A2"],
  );
  assert.equal(first.wells.pageInfo.hasNextPage, true);
  const next = (
    await read(base, "PlateOverview", {
      id: plateId,
      first: 2,
      after: first.wells.pageInfo.endCursor,
    })
  ).plate;
  assert.deepEqual(
    next.wells.edges.map(({ node }) => node.id),
    ["A3", "A4"],
  );
});

test("well history retains sequence, supersession, and the shared file identity of a reanalysis", async (t) => {
  const base = await runningServer(t);
  const { well } = await read(base, "WellHistory", { plateId, id: "C3" });
  assert.deepEqual(
    well.history.edges.map(({ node }) => node.sequence),
    [0, 1, 2],
  );
  const [first, second] = well.history.edges.map(({ node }) => node);
  assert.equal(second.kind, "reanalysis");
  assert.equal(second.supersedes.id, first.id);
  const r1 = (await read(base, "ResultDetails", { id: first.id })).result;
  const r2 = (await read(base, "ResultDetails", { id: second.id })).result;
  const files = (result) => result.artifacts.edges.map(({ node }) => node);
  const reused = files(r2).find((reference) => reference.file.kind === "bam");
  const original = files(r1).find((reference) => reference.file.kind === "bam");
  assert.equal(reused.file.id, original.file.id);
  assert.notEqual(
    reused.id,
    original.id,
    "References belong to their result while file identity is shared",
  );
  assert.equal(reused.reusedFrom.id, r1.id);
  assert.ok(
    original.file.sizeBytes > 2 ** 31,
    "Large object sizes retain their bytes without GraphQL Int overflow",
  );
});

test("missing entities, empty connections, and invalid variables have distinct responses", async (t) => {
  const base = await runningServer(t);
  assert.equal(
    (await read(base, "PlateOverview", { id: "missing" })).plate,
    null,
  );
  assert.equal(
    (await read(base, "WellHistory", { plateId, id: "missing" })).well,
    null,
  );
  assert.equal(
    (await read(base, "ResultDetails", { id: "missing" })).result,
    null,
  );
  const history = (await read(base, "WellHistory", { plateId, id: "C3" })).well
    .history;
  const empty = (
    await read(base, "ResultDetails", { id: history.edges[2].node.id })
  ).result.artifacts;
  assert.deepEqual(empty.edges, []);
  assert.equal(empty.pageInfo.hasNextPage, false);
  assert.equal(empty.pageInfo.endCursor, null);
  const badType = await post(
    base,
    envelope("PlateOverview", { id: plateId, first: "many" }),
  );
  assert.equal(badType.response.status, 400);
  assert.ok(badType.body.errors.length);
  for (const first of [0, -1, 51, null]) {
    const { body } = await post(
      base,
      envelope("PlateOverview", { id: plateId, first }),
    );
    assert.equal(body.errors[0].extensions.code, "BAD_USER_INPUT");
  }
  const { body: badCursor } = await post(
    base,
    envelope("PlateOverview", { id: plateId, after: "not-a-cursor" }),
  );
  assert.equal(badCursor.errors[0].extensions.code, "BAD_USER_INPUT");
  const lanes = await read(base, "CorridorOverview", { first: 1 });
  const { body: wrongCollection } = await post(
    base,
    envelope("PlateOverview", {
      id: plateId,
      after: lanes.corridor.lanes.pageInfo.endCursor,
    }),
  );
  assert.equal(wrongCollection.errors[0].extensions.code, "BAD_USER_INPUT");
});

test("production admits registered documents, rejects registration, batches, and oversized bodies", async (t) => {
  const base = await runningServer(t, { env: { GRAPHQL_EXPLORER: "1" } });
  const known = envelope("CorridorOverview");
  const unknown = structuredClone(known);
  unknown.extensions.persistedQuery.sha256Hash = "a".repeat(64);
  for (const body of [
    unknown,
    { query: "{ corridor { id } }" },
    { ...known, query: "{ corridor { id } }" },
    [known, known],
  ]) {
    const rejected = await post(base, body);
    assert.notEqual(rejected.response.status, 200, JSON.stringify(body));
    assert.ok(rejected.body.errors?.length);
  }
  const invalidJson = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(invalidJson.status, 400);
  const overLimit = JSON.stringify({
    ...known,
    padding: "x".repeat(API_LIMITS.bodyBytes),
  });
  const oversized = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: overLimit,
  });
  assert.equal(oversized.status, 413);
  // Chunked input reaches the stream counter rather than the Content-Length shortcut.
  const chunkedStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(
      `${base}/graphql`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "transfer-encoding": "chunked",
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      },
    );
    request.on("error", (error) =>
      error.code === "ECONNRESET" ? resolve("stream-closed") : reject(error),
    );
    request.write(overLimit.slice(0, 5000));
    request.end(overLimit.slice(5000));
  });
  assert.ok(
    [413, "stream-closed"].includes(chunkedStatus),
    "Oversized streams are rejected or closed by the HTTP adapter",
  );
  const response = await fetch(
    `${base}/graphql?extensions=${encodeURIComponent(JSON.stringify(known.extensions))}`,
    { headers: { origin: "https://example.invalid" } },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.corridor.id, "genomics-workflow");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const explorer = await fetch(`${base}/graphql`, {
    headers: { accept: "text/html" },
  });
  assert.doesNotMatch(await explorer.text(), /graphiql-container|GraphiQL/);
});

test("explicit local exploration accepts queries; resolver failures remain masked", async (t) => {
  const base = await runningServer(t, {
    env: { NODE_ENV: "development", GRAPHQL_EXPLORER: "1" },
  });
  const query = await post(base, { query: "{ corridor { id } }" });
  assert.equal(query.body.data.corridor.id, "genomics-workflow");
  // A bad adapter record simulates an internal resolver error without a public failure switch.
  const badLane = {
    ...exampleData.lanes[0],
    get label() {
      throw new Error("private adapter diagnostic");
    },
  };
  const { yoga } = createReadApi({
    data: { ...exampleData, lanes: [badLane, ...exampleData.lanes.slice(1)] },
  });
  const server = createServer(yoga);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const broken = await post(
    `http://127.0.0.1:${server.address().port}`,
    envelope("CorridorOverview"),
  );
  assert.equal(broken.body.data, null);
  assert.equal(broken.body.errors[0].message, "Unexpected error.");
  assert.doesNotMatch(
    JSON.stringify(broken.body),
    /private adapter diagnostic|stack/,
  );
});

test("a stalled read receives the configured request deadline instead of hanging the connection", async (t) => {
  const stalledLane = {
    ...exampleData.lanes[0],
    get label() {
      return new Promise(() => {});
    },
  };
  const { yoga } = createReadApi({
    data: {
      ...exampleData,
      lanes: [stalledLane, ...exampleData.lanes.slice(1)],
    },
  });
  const server = createServer(yoga);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { response, body } = await post(
    `http://127.0.0.1:${server.address().port}`,
    envelope("CorridorOverview"),
  );
  assert.equal(response.status, 504);
  assert.equal(body.errors[0].extensions.code, "REQUEST_TIMEOUT");
});

test("complete Plate history names its source and unavailable storage does not substitute fixture records", async (t) => {
  const base = await runningServer(t);
  const history = await read(base, "PlateHistory", { plateId, id: "C3" });
  assert.equal(history.dataSource.mode, "EXAMPLE");
  assert.equal(history.well.asOf, exampleData.asOf);
  assert.equal(history.well.history.totalCount, 3);
  assert.equal(history.well.history.pageInfo.hasNextPage, false);
  assert.ok(history.well.history.edges[0].node.metrics.length > 0);
  const unavailable = await runningServer(t, {
    env: { DB_HOST: "configured-but-incomplete" },
  });
  assert.equal(
    (await fetch(unavailable)).status,
    200,
    "Static showcase remains available",
  );
  assert.equal(
    (await read(unavailable, "CorridorOverview")).corridor.lanes.totalCount,
    11,
  );
  const failed = await post(
    unavailable,
    envelope("PlateHistory", { plateId, id: "C3" }),
  );
  assert.equal(failed.body.data.dataSource.mode, "STORED");
  assert.equal(failed.body.data.well, null);
  assert.equal(failed.body.errors[0].extensions.code, "DATA_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(failed.body), /configured-but-incomplete/);
});
