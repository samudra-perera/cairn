import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { claimTask, completeTask, createTask, getTask } from "../../src/core/tasks";
import { addNote, listNotesForTask } from "../../src/core/notes";
import { searchTasks } from "../../src/core/search";

describe("integration: full task lifecycle", () => {
  test("create -> claim -> note -> agent-complete (review) -> human-complete (done) -> still searchable", () => {
    const db = makeTestDb();

    const task = createTask(db, {
      title: "add jwt middleware",
      body: "needs tests",
      repo: "cairn",
      branch: "main",
      createdBy: "me",
    });
    expect(task.status).toBe("todo");

    const claim = claimTask(db, task.id, "claude");
    expect(claim.ok).toBe(true);
    if (!claim.ok) throw new Error("unreachable");
    expect(claim.task.status).toBe("doing");

    addNote(db, {
      taskId: task.id,
      repo: "cairn",
      branch: "main",
      author: "claude",
      body: "using jose, not jsonwebtoken",
      isAgent: true,
    });

    const reviewed = completeTask(db, task.id, "claude", true, "added jwt middleware with jose");
    expect(reviewed.status).toBe("review");

    const done = completeTask(db, task.id, "me", false, "approved, shipped");
    expect(done.status).toBe("done");
    expect(done.doneAt).not.toBeNull();

    const final = getTask(db, task.id);
    expect(final.status).toBe("done");

    const notes = listNotesForTask(db, task.id, { asAgent: false });
    expect(notes.length).toBe(1);

    const searchResults = searchTasks(
      db,
      "jwt",
      { repo: "cairn", branch: "main", scope: "branch" },
      { asAgent: false },
    );
    expect(searchResults.some((r) => r.taskId === task.id)).toBe(true);
  });
});
