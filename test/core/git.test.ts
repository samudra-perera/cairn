import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBranchCommits, getDiffStat, getLastCommitTime } from "../../src/core/git";

describe("core/git", () => {
  test("getDiffStat and getLastCommitTime return null gracefully outside a repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "cairn-git-test-"));
    try {
      expect(getDiffStat(dir, "main")).toBeNull();
      expect(getLastCommitTime(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("getBranchCommits", () => {
    function git(args: string[], cwd: string) {
      const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
      if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    }
    function commit(dir: string, file: string, message: string) {
      writeFileSync(join(dir, file), message);
      git(["add", "."], dir);
      git(["commit", "-q", "-m", message], dir);
    }
    function repo() {
      const dir = mkdtempSync(join(tmpdir(), "cairn-branch-commits-"));
      git(["init", "-q", "-b", "main"], dir);
      git(["config", "user.email", "t@example.com"], dir);
      git(["config", "user.name", "T"], dir);
      commit(dir, "a.txt", "init");
      return dir;
    }
    const withRepo = (fn: (dir: string) => void) => {
      const dir = repo();
      try {
        fn(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };

    test("lists the branch's commits oldest first, with short hash and subject", () =>
      withRepo((dir) => {
        git(["checkout", "-q", "-b", "feat/x"], dir);
        commit(dir, "b.txt", "first change");
        commit(dir, "c.txt", "second: with a colon");

        const commits = getBranchCommits(dir);
        expect(commits.map((c) => c.subject)).toEqual(["first change", "second: with a colon"]);
        expect(commits[0]?.hash).toBe(git(["rev-parse", "--short", "HEAD~1"], dir));
      }));

    test("is empty on the main line itself and on a branch with no new commits", () =>
      withRepo((dir) => {
        expect(getBranchCommits(dir)).toEqual([]);
        git(["checkout", "-q", "-b", "feat/empty"], dir);
        expect(getBranchCommits(dir)).toEqual([]);
      }));

    test("a stale local main doesn't pull main's own commits into the list", () =>
      withRepo((dir) => {
        // main moves ahead; the branch is cut from the newer main. Pointing a
        // stale `master` at the first commit must not make those count.
        git(["branch", "master"], dir);
        commit(dir, "m1.txt", "main moves on");
        git(["checkout", "-q", "-b", "feat/y"], dir);
        commit(dir, "y.txt", "branch work");
        expect(getBranchCommits(dir).map((c) => c.subject)).toEqual(["branch work"]);
      }));

    test("is empty outside a repo, and when there is no main or master", () => {
      const dir = mkdtempSync(join(tmpdir(), "cairn-branch-commits-norepo-"));
      try {
        expect(getBranchCommits(dir)).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      const dir2 = mkdtempSync(join(tmpdir(), "cairn-branch-commits-trunk-"));
      try {
        git(["init", "-q", "-b", "trunk"], dir2);
        git(["config", "user.email", "t@example.com"], dir2);
        git(["config", "user.name", "T"], dir2);
        commit(dir2, "a.txt", "init");
        expect(getBranchCommits(dir2)).toEqual([]);
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    });
  });
});
