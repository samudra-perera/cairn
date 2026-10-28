import type { Database } from "bun:sqlite";
import { openDb } from "../core/db";
import { getAgent, getRepoContext } from "../core/context";

export interface CliContext {
  db: Database;
  repo: string | null;
  branch: string | null;
  agent: string | null;
  isAgent: boolean;
  json: boolean;
}

export function buildCliContext(opts: { json?: boolean } = {}): CliContext {
  const db = openDb();
  const repoContext = getRepoContext();
  const agent = getAgent();

  return {
    db,
    repo: repoContext.repoId,
    branch: repoContext.branch,
    agent,
    isAgent: agent !== null,
    json: opts.json ?? false,
  };
}
