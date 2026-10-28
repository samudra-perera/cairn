import { Database } from "bun:sqlite";
import { migrate } from "../../src/core/db";

export function makeTestDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}
