import {
  documentationRoutes,
  serveDocumentation,
} from "../server/security/documentation-routes.mjs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import handler from "serve-handler";
import { createReadApi } from "../server/graphql/api.mjs";
import { readDatabaseConfig } from "../server/data/connection.mjs";
import { createConfiguredWorkspaceStore } from "../server/data/provider.mjs";
import { createWorkspaceApi } from "../server/workspaces/graphql.mjs";
import { createWorkspaceSessionPlugin } from "../server/workspaces/session.mjs";
import { documentPolicy } from "../server/security/document-policy.mjs";
import { createRequestAdmission } from "../server/security/request-admission.mjs";

const publicDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
const portValue = process.env.PORT ?? "3000";
const port = Number(portValue);

if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}

let html;
try {
  html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
} catch {
  throw new Error(
    "Production build is missing. Run npm run build before npm start.",
  );
}
const contentSecurityPolicy = documentPolicy(html);
const docs = await documentationRoutes(publicDirectory);

let exampleData;
let prepareSourceCommand;
try {
  ({ exampleData, prepareSourceCommand } =
    await import("../build/server/example-data.mjs"));
} catch (error) {
  throw new Error(
    "Server data build is missing or invalid. Run npm run build before npm start.",
    { cause: error },
  );
}
const explore =
  process.env.GRAPHQL_EXPLORER === "1" && process.env.NODE_ENV !== "production";
let database;
try {
  database = readDatabaseConfig();
} catch {
  database = { mode: "unavailable" };
  console.error(
    "Database settings need attention; stored records will report unavailable.",
  );
}
const requestAdmission = createRequestAdmission();
const { yoga } = createReadApi({
  data: exampleData,
  explore,
  database,
  requestAdmission,
});
const workspaceStore = createConfiguredWorkspaceStore(database);
const { yoga: workspaceYoga } = createWorkspaceApi({
  data: exampleData,
  prepareSourceCommand,
  sessionPlugin: createWorkspaceSessionPlugin({ store: workspaceStore }),
  requestAdmission,
});

const options = {
  public: publicDirectory,
  cleanUrls: false,
  directoryListing: false,
  renderSingle: false,
  symlinks: false,
  rewrites: [{ source: "/", destination: "/index.html" }],
  headers: [
    {
      source: "**",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
      ],
    },
    {
      source: "index.html",
      headers: [{ key: "Cache-Control", value: "no-cache" }],
    },
  ],
};

const server = createServer(
  { requestTimeout: 10_000, headersTimeout: 10_000 },
  (request, response) => {
    if (request.url?.split("?")[0] === "/workspace/graphql") {
      workspaceYoga(request, response);
      return;
    }
    if (request.url?.split("?")[0] === "/graphql") {
      yoga(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    if (serveDocumentation(request, response, docs)) return;

    handler(request, response, options).catch((error) => {
      console.error("Static response failed:", error.message);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  },
);

server.listen(port, explore ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`Serving production build on port ${server.address().port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close());
}
