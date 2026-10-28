import { describe, expect, test } from "bun:test";
import { makeTestDb } from "../helpers/testDb";
import { listEvents } from "../../src/core/events";
import {
  InvalidTransitionError,
  claimTask,
  completeTask,
  assignTask,
  createTask,
  listTasks,
  setStatus,
} from "../../src/core/tasks";

describe("core/tasks", () => {
  test("claimTask is atomic: concurrent claims on one task, exactly one wins", async () => {
    // bun:sqlite calls are synchronous, so Promise.all here doesn't create
    // real OS-level thread interleaving. What this DOES prove is that
    // claimTask uses a single atomic `UPDATE ... WHERE claimed_by IS NULL`
    // rather than a SELECT-then-UPDATE pattern — the guard is checked and
    // applied in one statement, so there's no window for two callers to both
    // read "unclaimed" before either writes. A SELECT-then-UPDATE version
    // would also pass this sequential test while still being racy under
    // true multi-process concurrency.
    const db = makeTestDb();
    const task = createTask(db, {
      title: "race me",
      repo: null,
      branch: null,
      createdBy: "me",
    });

    const [a, b] = await Promise.all([
      Promise.resolve(claimTask(db, task.id, "claude")),
      Promise.resolve(claimTask(db, task.id, "pi")),
    ]);

    const results = [a, b];
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);

    const winner = winners[0];
    const loser = losers[0];
    if (!winner?.ok || loser?.ok !== false) throw new Error("unexpected claim shapes");

    expect(loser.reason).toBe("already_claimed");
    expect(winner.task.claimedBy).not.toBeNull();
    expect(["claude", "pi"]).toContain(winner.task.claimedBy as string);
  });

  test("claimTask on a nonexistent task returns not_found", () => {
    const db = makeTestDb();
    const result = claimTask(db, 999, "claude");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("claimTask on an already-claimed task returns already_claimed", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "t",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    claimTask(db, task.id, "claude");
    const second = claimTask(db, task.id, "pi");
    expect(second).toEqual({ ok: false, reason: "already_claimed" });
  });

  test("setStatus throws InvalidTransitionError when an agent sets status to done directly", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "t",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    expect(() => setStatus(db, task.id, "done", "claude", true)).toThrow(InvalidTransitionError);
  });

  test("setStatus allows a human to set status to done directly", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "t",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const updated = setStatus(db, task.id, "done", "me", false);
    expect(updated.status).toBe("done");
    expect(updated.doneAt).not.toBeNull();
  });

  test("Assign an unclaimed task", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "temp",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const assigned = assignTask(db, task.id, "claude", "me");
    if (!assigned.ok) throw new Error("Expected assign to succeed");
    expect(assigned.task.claimedBy).toBe("claude");
  });

  test("assignTask on a nonexistent task returns not_found", () => {
    const db = makeTestDb();
    const result = assignTask(db, 999, "claude", "me");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("assignTask status to be todo", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "temp",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const assigned = assignTask(db, task.id, "claude", "me");
    if (!assigned.ok) throw new Error("Expected assign to succeed");
    expect(assigned.task.status).toBe("todo");
  });

  test("assignTask after a task has been claimed", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "temp",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const claim = claimTask(db, task.id, "pi");
    if (!claim.ok) throw new Error("setup claim failed");

    const assigned = assignTask(db, task.id, "claude", "me");
    if (!assigned.ok) throw new Error("Expected reassign to succeed");
    expect(assigned.task.claimedBy).toBe("claude");
    expect(assigned.task.status).toBe("doing");
  });

  test("assignTask logs an assigned event with previous null for an unclaimed task", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "temp",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const assigned = assignTask(db, task.id, "claude", "me");
    if (!assigned.ok) throw new Error("Expected assign to succeed");

    const event = listEvents(db, task.id).find((e) => e.kind === "assigned");
    expect(event).toBeDefined();
    expect(event?.actor).toBe("me");
    expect(event?.data).toEqual({ assignedTo: "claude", previous: null });
  });

  test("assignTask records the previous assignee in the event on reassignment", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "temp",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const claim = claimTask(db, task.id, "pi");
    if (!claim.ok) throw new Error("setup claim failed");
    const assigned = assignTask(db, task.id, "claude", "me");
    if (!assigned.ok) throw new Error("Expected reassign to succeed");

    const event = listEvents(db, task.id).find((e) => e.kind === "assigned");
    expect(event?.data).toEqual({ assignedTo: "claude", previous: "pi" });
  });

  test("assignTask on a nonexistent task logs no event", () => {
    const db = makeTestDb();
    const other = createTask(db, {
      title: "other",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const before = listEvents(db, other.id).length;

    assignTask(db, 999, "claude", "me");

    expect(listEvents(db, 999)).toEqual([]);
    expect(listEvents(db, other.id).length).toBe(before);
  });

  test("completeTask as an agent moves the task to review, not done", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "t",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const updated = completeTask(db, task.id, "claude", true, "added jwt middleware");
    expect(updated.status).toBe("review");
    expect(updated.doneAt).toBeNull();
    expect(updated.summary).toBe("added jwt middleware");
  });

  test("completeTask as a human moves the task to done", () => {
    const db = makeTestDb();
    const task = createTask(db, {
      title: "t",
      repo: null,
      branch: null,
      createdBy: "me",
    });
    const updated = completeTask(db, task.id, "me", false, "shipped it");
    expect(updated.status).toBe("done");
    expect(updated.doneAt).not.toBeNull();
  });

  test("listTasks scope filtering: branch, repo, and all", () => {
    const db = makeTestDb();
    createTask(db, {
      title: "a",
      repo: "repoA",
      branch: "main",
      createdBy: "me",
    });
    createTask(db, {
      title: "b",
      repo: "repoA",
      branch: "feat/x",
      createdBy: "me",
    });
    createTask(db, {
      title: "c",
      repo: "repoB",
      branch: "main",
      createdBy: "me",
    });
    createTask(db, {
      title: "global",
      repo: null,
      branch: null,
      createdBy: "me",
    });

    const branchScoped = listTasks(db, {
      repo: "repoA",
      branch: "main",
      scope: "branch",
    });
    expect(branchScoped.map((t) => t.title)).toEqual(["a"]);

    const repoScoped = listTasks(db, {
      repo: "repoA",
      branch: "main",
      scope: "repo",
    });
    expect(repoScoped.map((t) => t.title).sort()).toEqual(["a", "b"]);

    const allScoped = listTasks(db, {
      repo: "repoA",
      branch: "main",
      scope: "all",
    });
    expect(allScoped.map((t) => t.title).sort()).toEqual(["a", "b", "c", "global"]);

    const globalScoped = listTasks(db, {
      repo: null,
      branch: null,
      scope: "branch",
    });
    expect(globalScoped.map((t) => t.title)).toEqual(["global"]);
  });
});
