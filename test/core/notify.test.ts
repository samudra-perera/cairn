import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { createTask, setStatus } from "../../src/core/tasks";
import { addNote } from "../../src/core/notes";
import { getNewNotifications, markSeen } from "../../src/core/notify";

describe("core/notify", () => {
  test("a note shows up exactly once across two sequential invocations", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    addNote(db, {
      taskId: task.id,
      repo: null,
      branch: null,
      author: "me",
      body: "use jose, not jsonwebtoken",
      isAgent: false,
    });

    const first = getNewNotifications(db, "claude");
    expect(first.length).toBe(1);
    expect(first[0]?.message).toContain("use jose, not jsonwebtoken");
    markSeen(db, "claude");

    const second = getNewNotifications(db, "claude");
    expect(second.length).toBe(0);
  });

  test("a note written by the agent itself does not notify that agent", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    addNote(db, {
      taskId: task.id,
      repo: null,
      branch: null,
      author: "claude",
      body: "my own note",
      isAgent: true,
    });

    const notifications = getNewNotifications(db, "claude");
    expect(notifications.length).toBe(0);
  });

  test("a status change by someone else notifies, but is filtered to private-safe content", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    setStatus(db, task.id, "doing", "me", false);

    const notifications = getNewNotifications(db, "claude");
    expect(notifications.length).toBe(1);
    expect(notifications[0]?.kind).toBe("status");
  });

  test("two different agents each see their own unseen notifications independently", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    addNote(db, {
      taskId: task.id,
      repo: null,
      branch: null,
      author: "me",
      body: "hello",
      isAgent: false,
    });

    markSeen(db, "claude");
    const claudeSees = getNewNotifications(db, "claude");
    const piSees = getNewNotifications(db, "pi");

    expect(claudeSees.length).toBe(0);
    expect(piSees.length).toBe(1);
  });
});
