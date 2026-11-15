import { beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { makeTestDb } from "../helpers/testDb";
import { createTask } from "../../src/core/tasks";
import { listEvents } from "../../src/core/events";
import { commitsFromEvents, recordCommits } from "../../src/core/commits";

describe("core/commits", () => {
  let db: Database;
  let taskId: number;
  beforeEach(() => {
    db = makeTestDb();
    taskId = createTask(db, { title: "t", repo: "r", branch: "b", createdBy: "me" }).id;
  });

  const commit = (hash: string, subject = `subject ${hash}`) => ({ hash, subject });

  test("recordCommits logs one event and returns the commits", () => {
    const added = recordCommits(db, taskId, "claude", [commit("aaa1111"), commit("bbb2222")]);
    expect(added.map((c) => c.hash)).toEqual(["aaa1111", "bbb2222"]);

    const events = listEvents(db, taskId).filter((e) => e.kind === "commits");
    expect(events).toHaveLength(1);
    expect(events[0]?.actor).toBe("claude");
  });

  test("recording nothing logs nothing", () => {
    expect(recordCommits(db, taskId, "me", [])).toEqual([]);
    expect(listEvents(db, taskId).some((e) => e.kind === "commits")).toBe(false);
  });

  test("running again only records commits that are new", () => {
    recordCommits(db, taskId, "me", [commit("aaa1111")]);
    const second = recordCommits(db, taskId, "me", [commit("aaa1111"), commit("ccc3333")]);
    expect(second.map((c) => c.hash)).toEqual(["ccc3333"]);

    const none = recordCommits(db, taskId, "me", [commit("aaa1111"), commit("ccc3333")]);
    expect(none).toEqual([]);
    expect(listEvents(db, taskId).filter((e) => e.kind === "commits")).toHaveLength(2);
  });

  test("commitsFromEvents returns them in order across several events", () => {
    recordCommits(db, taskId, "me", [commit("aaa1111"), commit("bbb2222")]);
    recordCommits(db, taskId, "me", [commit("ccc3333")]);
    expect(commitsFromEvents(listEvents(db, taskId)).map((c) => c.hash)).toEqual([
      "aaa1111",
      "bbb2222",
      "ccc3333",
    ]);
  });

  test("commitsFromEvents ignores other events and malformed data", () => {
    const events = listEvents(db, taskId);
    expect(commitsFromEvents(events)).toEqual([]);
    const bad = { ...events[0]!, kind: "commits", data: { commits: "nope" } };
    expect(commitsFromEvents([bad])).toEqual([]);
  });

  test("commits are per task", () => {
    const other = createTask(db, { title: "o", repo: "r", branch: "b", createdBy: "me" }).id;
    recordCommits(db, taskId, "me", [commit("aaa1111")]);
    expect(commitsFromEvents(listEvents(db, other))).toEqual([]);
  });
});
