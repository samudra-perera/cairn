import type { Database } from "bun:sqlite";
import { openDb } from "../core/db";

let sharedDb: Database | null = null;

/** One connection for the whole TUI process, opened on first use. */
export function getSharedDb(): Database {
  if (!sharedDb) sharedDb = openDb();
  return sharedDb;
}

/** Drops the shared connection so the next use reopens from CAIRN_DB_PATH. For tests. */
export function resetSharedDb(): void {
  sharedDb?.close();
  sharedDb = null;
}
