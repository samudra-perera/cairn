import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { createTask } from "../../src/core/tasks";
import { listEvents, logEvent } from "../../src/core/events";

describe("core/events", () => {
  test("listEvents returns events ordered by created_at ascending", async () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    // createTask already logs a 'created' event; add two more.
    logEvent(db, { taskId: task.id, actor: "claude", kind: "claimed", data: { claimedBy: "claude" } });
    logEvent(db, { taskId: task.id, actor: "claude", kind: "summary", data: { summary: "done" } });

    const events = listEvents(db, task.id);
    expect(events.map((e) => e.kind)).toEqual(["created", "claimed", "summary"]);
  });

  test("event data is stored and read back as the original JSON value", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    logEvent(db, { taskId: task.id, actor: "me", kind: "status", data: { from: "todo", to: "doing" } });

    const [created, status] = listEvents(db, task.id);
    expect(created?.data).toEqual({ title: "t" });
    expect(status?.data).toEqual({ from: "todo", to: "doing" });
  });

  test("logEvent with no data stores null and reads back null", () => {
    const db = makeTestDb();
    const task = createTask(db, { title: "t", repo: null, branch: null, createdBy: "me" });
    logEvent(db, { taskId: task.id, actor: "me", kind: "noted" });

    const events = listEvents(db, task.id);
    const noted = events.find((e) => e.kind === "noted");
    expect(noted?.data).toBeNull();
  });
});
