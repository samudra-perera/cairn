import type { Database } from "bun:sqlite";
import { openDb } from "../core/db";
import { callerIdentity, getAgent, getRepoContext } from "../core/context";
import { getUserName } from "../core/config";
import { validateName } from "../core/names";
import { fail } from "./output";

export interface CliContext {
  db: Database;
  repo: string | null;
  branch: string | null;
  agent: string | null;
  /** Who is acting: the agent if CAIRN_AGENT is set, else the human's name from `cairn init`. */
  actor: string;
  /** The human's name, used as the default task owner. */
  userName: string;
  isAgent: boolean;
  json: boolean;
}

export function buildCliContext(
  opts: { json?: boolean; skipIdentityHint?: boolean } = {},
): CliContext {
  const db = openDb();
  const repoContext = getRepoContext();
  const agent = getAgent();
  const userName = getUserName();

  if (!userName && !agent && !opts.json && !opts.skipIdentityHint) {
    console.error('cairn: no name set, using "me". Run `cairn init` to set one.');
  }

  const ctx: CliContext = {
    db,
    repo: repoContext.repoId,
    branch: repoContext.branch,
    agent,
    actor: callerIdentity(),
    userName: userName ?? "me",
    isAgent: agent !== null,
    json: opts.json ?? false,
  };

  const agentError = agent ? validateName(agent) : null;
  if (agentError) fail(ctx, `CAIRN_AGENT: ${agentError}`);

  return ctx;
}
