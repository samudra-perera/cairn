import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { getDataVersion, migrate } from "../../src/core/db";

describe("core/db", () => {
  test("migrate creates expected tables and sets user_version", () => {
    const db = new Database(":memory:");
    migrate(db);

    const tables = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all()
      .map((r) => r.name);

    for (const expected of ["features", "tasks", "notes", "events", "refs", "agent_seen"]) {
      expect(tables).toContain(expected);
    }

    const version = db.query<{ user_version: number }, []>("PRAGMA user_version;").get();
    expect(version?.user_version).toBe(1);
  });

  test("migrate is idempotent on a second call", () => {
    const db = new Database(":memory:");
    migrate(db);
    expect(() => migrate(db)).not.toThrow();

    const version = db.query<{ user_version: number }, []>("PRAGMA user_version;").get();
    expect(version?.user_version).toBe(1);
  });

  test("FTS triggers populate tasks_fts on insert", () => {
    const db = new Database(":memory:");
    migrate(db);

    db.run(
      `INSERT INTO tasks (title, body, owner, created_by, created_at, updated_at)
       VALUES ('find me', 'uniquebodytext', 'me', 'me', '2026-01-01', '2026-01-01')`,
    );

    const match = db
      .query<{ rowid: number }, [string]>(`SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH ?`)
      .all("uniquebodytext");

    expect(match.length).toBe(1);
  });

  test("getDataVersion reflects writes from OTHER connections, not the same one", () => {
    // PRAGMA data_version is designed to detect cross-connection changes
    // (e.g. the TUI's connection noticing a CLI command's write in another
    // process) — it does NOT bump for writes made by the same connection
    // that's reading it. Two file-backed connections model that correctly;
    // a single :memory: connection would not.
    const tmpPath = `${import.meta.dir}/../../.tmp-data-version-test.db`;
    try {
      const writerDb = new Database(tmpPath, { create: true });
      migrate(writerDb);

      const readerDb = new Database(tmpPath);
      const before = getDataVersion(readerDb);

      writerDb.run(
        `INSERT INTO tasks (title, owner, created_by, created_at, updated_at)
         VALUES ('x', 'me', 'me', '2026-01-01', '2026-01-01')`,
      );

      const after = getDataVersion(readerDb);
      expect(after).not.toBe(before);

      writerDb.close();
      readerDb.close();
    } finally {
      try {
        require("node:fs").rmSync(tmpPath, { force: true });
        require("node:fs").rmSync(`${tmpPath}-wal`, { force: true });
        require("node:fs").rmSync(`${tmpPath}-shm`, { force: true });
      } catch {}
    }
  });
});
