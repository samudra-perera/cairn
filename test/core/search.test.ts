import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { createTask } from "../../src/core/tasks";
import { addNote } from "../../src/core/notes";
import { searchTasks } from "../../src/core/search";

describe("core/search", () => {
  test("finds matches across task titles/bodies and note bodies", () => {
    const db = makeTestDb();
    createTask(db, { title: "jwt middleware", body: "use jose", repo: null, branch: null, createdBy: "me" });
    const task2 = createTask(db, { title: "unrelated", repo: null, branch: null, createdBy: "me" });
    addNote(db, { taskId: task2.id, repo: null, branch: null, author: "me", body: "jose works great", isAgent: false });

    const results = searchTasks(db, "jose", { repo: null, branch: null, scope: "all" }, { asAgent: false });
    expect(results.length).toBe(2);
    expect(results.map((r) => r.kind).sort()).toEqual(["note", "task"]);
  });

  test("a hyphenated query does not throw an FTS5 syntax error", () => {
    const db = makeTestDb();
    createTask(db, { title: "feat-auth work", repo: null, branch: null, createdBy: "me" });
    expect(() => searchTasks(db, "feat-auth", { repo: null, branch: null, scope: "all" }, { asAgent: false })).not.toThrow();
    const results = searchTasks(db, "feat-auth", { repo: null, branch: null, scope: "all" }, { asAgent: false });
    expect(results.length).toBe(1);
  });

  test("respects branch scope filtering", () => {
    const db = makeTestDb();
    createTask(db, { title: "scoped match", repo: "repoA", branch: "main", createdBy: "me" });
    createTask(db, { title: "scoped match", repo: "repoA", branch: "feat/x", createdBy: "me" });

    const branchScoped = searchTasks(db, "scoped match", { repo: "repoA", branch: "main", scope: "branch" }, { asAgent: false });
    expect(branchScoped.length).toBe(1);

    const repoScoped = searchTasks(db, "scoped match", { repo: "repoA", branch: "main", scope: "repo" }, { asAgent: false });
    expect(repoScoped.length).toBe(2);
  });
});
