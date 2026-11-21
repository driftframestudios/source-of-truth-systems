import {
  decodeWorkspaceResponse,
  type WorkspaceOutcome,
} from "./workspaceResponse";
import type { WORKSPACE_CODES } from "../../../shared/workspace-contract.mjs";
import type { ScenarioInput } from "../../../shared/permission-scope.mjs";

// Reviewed operation documents live in server/workspaces/operations; the API test checks these identities.
export const WORKSPACE_OPERATIONS = {
  ResetWorkspace:
    "adf6dfa8bef0b90ae15dc7abbcbf76be1e1ff4dfa286bc5d3a403d34410eebcd",
  RestoreSource:
    "de7aa872ae7d9f097111e2b7e18bee96d4d88db7b7514a28dc8c1aa80bcde2c3",
  SaveSource:
    "b0882602289162289c8618be4e0070dcdcb36700ef6a1cb7229c68191b24d130",
  StartWorkspace:
    "d2d0cfc354979318c173c8a6be4746ff1689c98d99f0374d9f6e59b9b53b128a",
  WorkspaceHistory:
    "6972326894590e55fe2d41d38592d5c0eadd546dec210e0139266f07155d994e",
  WorkspaceSnapshot:
    "93e0e9d023b642a6f68e2c986ef87cb5650dd1002b138ed349a7c2e8931936c6",
  WorkspaceSource:
    "b27c468d58e81eac92cb14c1bdb6d2283c1158db932a6d3cac4779d9affce616",
  WorkspaceStatus:
    "7a1850715aa07dc86311bf476a7fbe06047781971e518d71d82eac011b211923",
} as const;
export type WorkspaceOperation = keyof typeof WORKSPACE_OPERATIONS;
export type WorkspaceCode = (typeof WORKSPACE_CODES)[number];
export interface VisitorWorkspace {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly eventCount: number;
}
export interface WorkspaceSource {
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly description: string;
  readonly tags: ReadonlyArray<string>;
}
export interface WorkspaceEvent {
  readonly id: string;
  readonly sourceId: string;
  readonly action: "save" | "restore";
  readonly createdAt: string;
  readonly expectedRevision: number;
  readonly resultRevision: number;
  readonly actor: {
    readonly principalId: string;
    readonly roleId: string;
    readonly environment: string;
  };
}
export interface WorkspaceResponse {
  readonly code: WorkspaceCode;
  readonly message: string;
  readonly workspace?: VisitorWorkspace | null;
  readonly source?: WorkspaceSource | null;
  readonly sources?: ReadonlyArray<WorkspaceSource>;
  readonly events?: ReadonlyArray<WorkspaceEvent>;
  readonly changed?: boolean;
  readonly replayed?: boolean;
}
export type WorkspaceRequest = <O extends WorkspaceOperation>(
  operation: O,
  variables: Record<string, unknown>,
  scenario: ScenarioInput,
) => Promise<WorkspaceOutcome<O>>;
export const requestWorkspace: WorkspaceRequest = async (
  operation,
  variables,
  scenario,
) => {
  // Vite source development has no hosted API; production failures remain explicit refusals.
  if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)
    return { code: "LOCAL", message: "Changes stay in this browser session." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/workspace/graphql", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-sot-workspace": "1" },
      body: JSON.stringify({
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: WORKSPACE_OPERATIONS[operation],
          },
          scenario,
        },
        variables,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error("Workspace request unavailable.");
    const value = decodeWorkspaceResponse(operation, body, variables);
    if (!value) throw new Error("Workspace response unavailable.");
    return value;
  } catch {
    // A timed-out mutation may already be accepted; its caller retains the same command identity for retry.
    return {
      code: "UNAVAILABLE",
      message:
        "The workspace could not confirm this request. Keep your draft and retry.",
    };
  } finally {
    clearTimeout(timeout);
  }
};
