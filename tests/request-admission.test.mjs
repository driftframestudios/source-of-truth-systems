import assert from "node:assert/strict";
import test from "node:test";
import { useRequestDeadline } from "@whatwg-node/server";
import {
  exampleData,
  prepareSourceCommand,
} from "../build/server/example-data.mjs";
import { createReadApi } from "../server/graphql/api.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";
import { createWorkspaceSessionPlugin } from "../server/workspaces/session.mjs";
import { createRequestAdmission } from "../server/security/request-admission.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function send(api, name, path = "/graphql") {
  const operation = api.operations.find((entry) => entry.name === name);
  assert.ok(operation);
  return api.yoga.fetch(`https://example.test${path}`, {
    method: "POST",
    headers: {
      host: "example.test",
      origin: "https://example.test",
      "content-type": "application/json",
      "x-sot-workspace": "1",
    },
    body: JSON.stringify({
      extensions: {
        persistedQuery: { version: 1, sha256Hash: operation.sha256Hash },
      },
    }),
  });
}
async function busy(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(
    (await response.json()).errors[0].extensions.code,
    "SERVICE_BUSY",
  );
}

test("read and workspace routes share capacity; overflow never enters storage and completion admits a retry", async (t) => {
  const entered = deferred(),
    release = deferred();
  t.after(() => release.resolve());
  let calls = 0;
  const store = {
    async status() {
      calls += 1;
      entered.resolve();
      await release.promise;
      return { available: true, mode: "stored" };
    },
  };
  const requestAdmission = createRequestAdmission({ concurrent: 1 });
  const workspace = createWorkspaceApi({
    data: exampleData,
    prepareSourceCommand,
    sessionPlugin: createWorkspaceSessionPlugin({ store }),
    requestAdmission,
  });
  const reads = createReadApi({ data: exampleData, requestAdmission });
  const pending = send(workspace, "WorkspaceStatus", "/workspace/graphql");
  await entered.promise;
  await busy(await send(workspace, "WorkspaceStatus", "/workspace/graphql"));
  await busy(await send(reads, "CorridorOverview"));
  assert.equal(calls, 1);
  release.resolve();
  assert.equal(
    (await (await pending).json()).data.workspaceStatus.code,
    "ABSENT",
  );
  const recovered = await send(reads, "CorridorOverview");
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).data.corridor.lanes.totalCount, 11);
  assert.equal(
    (await send(workspace, "WorkspaceStatus", "/workspace/graphql")).status,
    200,
  );
  assert.equal(calls, 2);
});

const fetchAPI = { Response };
function wrap(plugin, request, requestHandler) {
  let wrapped = requestHandler;
  plugin.onRequest({
    request,
    requestHandler,
    setRequestHandler: (value) => {
      wrapped = value;
    },
  });
  return wrapped;
}

test("handler failures release their slot and preserve the original failure", async () => {
  const plugin = createRequestAdmission({ concurrent: 1 });
  const request = new Request("https://example.test/graphql");
  const failure = new Error("Owned handler failure");
  for (const handler of [
    () => {
      throw failure;
    },
    async () => {
      throw failure;
    },
  ]) {
    await assert.rejects(
      wrap(plugin, request, handler)(request, {}, fetchAPI),
      (error) => error === failure,
    );
    const next = wrap(plugin, request, () => Response.json({ ok: true }));
    assert.equal((await next(request, {}, fetchAPI)).status, 200);
  }
});

test("a response deadline keeps unfinished work counted until its cleanup settles", async (t) => {
  const release = deferred();
  t.after(() => release.resolve());
  const plugin = createRequestAdmission({ concurrent: 1 });
  const request = new Request("https://example.test/graphql");
  const guarded = wrap(plugin, request, async () => {
    await release.promise;
    return Response.json({ ok: true });
  });
  let underlying;
  const deadline = wrap(
    useRequestDeadline({
      timeout: 10,
      response: () => new Response(null, { status: 504 }),
    }),
    request,
    (...args) => {
      underlying = guarded(...args);
      return underlying;
    },
  );
  assert.equal((await deadline(request, {}, fetchAPI)).status, 504);
  assert.equal(request.signal.aborted, true);
  const nextRequest = new Request("https://example.test/graphql");
  const next = wrap(plugin, nextRequest, () => Response.json({ ok: true }));
  await busy(await next(nextRequest, {}, fetchAPI));
  release.resolve();
  await underlying;
  assert.equal((await next(nextRequest, {}, fetchAPI)).status, 200);
});
