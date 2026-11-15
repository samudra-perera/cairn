import { beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { makeTestDb } from "../helpers/testDb";
import { claimTask, createTask, findCurrentTask, setStatus } from "../../src/core/tasks";

describe("core/tasks findCurrentTask", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
  });

  const add = (title: string, branch: string | null = "feat/x", repo: string | null = "r") =>
    createTask(db, { title, repo, branch, createdBy: "me" });
  const where = (over: { repo?: string | null; branch?: string | null; actor?: string } = {}) => ({
    repo: "r",
    branch: "feat/x",
    actor: "me",
    ...over,
  });

  test("the only open task on this branch", () => {
    const t = add("only");
    add("other branch", "feat/y");
    expect(findCurrentTask(db, where())).toMatchObject({
      ok: true,
      via: "branch",
      task: { id: t.id },
    });
  });

  test("finished tasks on the branch are ignored", () => {
    const t = add("finished");
    setStatus(db, t.id, "done", "me", false);
    expect(findCurrentTask(db, where())).toMatchObject({ ok: false, reason: "none" });
  });

  test("with several on the branch, prefers the one you've claimed", () => {
    add("a");
    const mine = add("b");
    claimTask(db, mine.id, "me");
    expect(findCurrentTask(db, where())).toMatchObject({ ok: true, task: { id: mine.id } });
  });

  test("several on the branch and none or several claimed is ambiguous, listing candidates", () => {
    add("a");
    add("b");
    const none = findCurrentTask(db, where());
    expect(none).toMatchObject({ ok: false, reason: "ambiguous" });
    expect(none.ok ? [] : none.candidates).toHaveLength(2);

    for (const t of [1, 2]) claimTask(db, t, "me");
    expect(findCurrentTask(db, where())).toMatchObject({ ok: false, reason: "ambiguous" });
  });

  test("with nothing on this branch, falls back to your one in-progress task in the repo", () => {
    const t = add("elsewhere", "main");
    claimTask(db, t.id, "me");
    expect(findCurrentTask(db, where())).toMatchObject({
      ok: true,
      via: "claimed",
      task: { id: t.id },
    });
  });

  test("the fallback ignores other people's, unclaimed and other-repo tasks", () => {
    const theirs = add("theirs", "main");
    claimTask(db, theirs.id, "claude");
    add("unclaimed", "main");
    const otherRepo = add("other repo", "main", "elsewhere");
    claimTask(db, otherRepo.id, "me");
    expect(findCurrentTask(db, where())).toMatchObject({ ok: false, reason: "none" });
  });

  test("two in-progress tasks elsewhere is ambiguous", () => {
    for (const title of ["a", "b"]) claimTask(db, add(title, "main").id, "me");
    expect(findCurrentTask(db, where())).toMatchObject({ ok: false, reason: "ambiguous" });
  });

  test("outside a repo there is nothing to infer; a detached HEAD still uses the fallback", () => {
    add("t");
    expect(findCurrentTask(db, where({ repo: null, branch: null }))).toMatchObject({
      ok: false,
      reason: "none",
    });
    const t = add("elsewhere", "main");
    claimTask(db, t.id, "me");
    expect(findCurrentTask(db, where({ branch: null }))).toMatchObject({
      ok: true,
      via: "claimed",
    });
  });
});
