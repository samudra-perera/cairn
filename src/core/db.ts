import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

export function resolveDbPath(override?: string): string {
  return override ?? process.env.CAIRN_DB_PATH ?? join(homedir(), ".cairn", "cairn.db");
}

export function openDb(path?: string): Database {
  const dbPath = resolveDbPath(path);
  if (dbPath !== ":memory:") {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function migrate(db: Database): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const currentVersion = db.query("PRAGMA user_version;").get() as { user_version: number };
  let version = currentVersion.user_version;

  for (const file of files) {
    const migrationNumber = parseInt(file.split("_")[0] ?? "0", 10);
    if (migrationNumber <= version) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    db.run("BEGIN;");
    try {
      db.run(sql);
      db.run(`PRAGMA user_version = ${migrationNumber};`);
      db.run("COMMIT;");
      version = migrationNumber;
    } catch (err) {
      db.run("ROLLBACK;");
      throw err;
    }
  }
}

export function getDataVersion(db: Database): number {
  const row = db.query("PRAGMA data_version;").get() as { data_version: number };
  return row.data_version;
}
