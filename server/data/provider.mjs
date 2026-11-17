import { createConnectionScope } from "./connection.mjs";
import { createMySqlRepository } from "./mysql-repository.mjs";
import { createPostgresConnectionScope } from "../postgres/connection.mjs";
import { createPostgresRepository } from "./postgres-repository.mjs";
import { createWorkspaceStore } from "../workspaces/store.mjs";
import { createPostgresWorkspaceStore } from "../workspaces/postgres-store.mjs";

const providers = Object.freeze({
  mysql: {
    scope: createConnectionScope,
    repository: createMySqlRepository,
    workspaces: createWorkspaceStore,
  },
  postgres: {
    scope: createPostgresConnectionScope,
    repository: createPostgresRepository,
    workspaces: createPostgresWorkspaceStore,
  },
});

export function createCatalogScope(database, signal) {
  const provider = providers[database.mode];
  if (!provider) return null;
  const scope = provider.scope(database.options, signal);
  let repository;
  return {
    repository: () => (repository ??= scope.get().then(provider.repository)),
    close: () => scope.close(),
  };
}

export function createConfiguredWorkspaceStore(database) {
  const provider = providers[database.mode];
  return provider
    ? provider.workspaces(database.options)
    : {
        status: async () => ({
          available: false,
          mode: database.mode === "example" ? "local" : "unavailable",
        }),
      };
}
