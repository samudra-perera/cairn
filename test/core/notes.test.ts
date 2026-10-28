import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { createTask } from "../../src/core/tasks";
import { searchTasks } from "../../src/core/search";
import {
  PrivateNoteForbiddenError,
  addNote,
  filterPrivate,
  listNotesForTask,
  listStandaloneNotes,
} from "../../src/core/notes";

describe("core/notes", () => {
  test("filterPrivate strips private notes only when asAgent is true", () => {
    const notes = [{ private: false }, { private: true }, { private: false }];
    expect(filterPrivate(notes, true)).toEqual([{ private: false }, { private: false }]);
    expect(filterPrivate(notes, false)).toEqual(notes);
  });

  test("addNote throws PrivateNoteForbiddenError when an agent tries to write a private note", () => {
    const db = makeTestDb();
    expect(() =>
      addNote(db, { repo: null, branch: null, author: "claude", body: "shh", private: true, isAgent: true }),
    ).toThrow(PrivateNoteForbiddenError);
  });

  test("addNote allows a human to write a private note", () => {
    const db = makeTestDb();
    const note = addNote(db, { repo: null, branch: null, author: "me", body: "shh", private: true, isAgent: false });
    expect(note.private).toBe(true);
  });

  test("listNotesForTask never returns private notes to an agent, directly", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    addNote(db, { taskId: task.id, repo: null, branch: null, author: "me", body: "public note", isAgent: false });
    addNote(db, {
      taskId: task.id,
      repo: null,
      branch: null,
      author: "me",
      body: "secret note",
      private: true,
      isAgent: false,
    });

    const asAgent = listNotesForTask(db, task.id, { asAgent: true });
    expect(asAgent.map((n) => n.body)).toEqual(["public note"]);

    const asHuman = listNotesForTask(db, task.id, { asAgent: false });
    expect(asHuman.map((n) => n.body).sort()).toEqual(["public note", "secret note"]);
  });

  test("listStandaloneNotes scopes by branch/repo/all like tasks", () => {
    const db = makeTestDb();
    addNote(db, { repo: "repoA", branch: "main", author: "me", body: "a-main", isAgent: false });
    addNote(db, { repo: "repoA", branch: "feat/x", author: "me", body: "a-feat", isAgent: false });
    addNote(db, { repo: null, branch: null, author: "me", body: "personal", isAgent: false });

    const branchScoped = listStandaloneNotes(db, { repo: "repoA", branch: "main", scope: "branch" }, { asAgent: false });
    expect(branchScoped.map((n) => n.body)).toEqual(["a-main"]);

    const repoScoped = listStandaloneNotes(db, { repo: "repoA", branch: "main", scope: "repo" }, { asAgent: false });
    expect(repoScoped.map((n) => n.body).sort()).toEqual(["a-feat", "a-main"]);

    const globalScoped = listStandaloneNotes(db, { repo: null, branch: null, scope: "branch" }, { asAgent: false });
    expect(globalScoped.map((n) => n.body)).toEqual(["personal"]);
  });

  test("a private note never leaks through search.ts either, not just notes.ts's own reads", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "findable task", repo: null, branch: null, createdBy: "me" });
    addNote(db, {
      taskId: task.id,
      repo: null,
      branch: null,
      author: "me",
      body: "topsecretplan",
      private: true,
      isAgent: false,
    });

    const resultsAsAgent = searchTasks(db, "topsecretplan", { repo: null, branch: null, scope: "all" }, { asAgent: true });
    expect(resultsAsAgent).toEqual([]);

    const resultsAsHuman = searchTasks(db, "topsecretplan", { repo: null, branch: null, scope: "all" }, { asAgent: false });
    expect(resultsAsHuman.length).toBe(1);
  });
});
