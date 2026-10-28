import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GitCommandError,
  callerIdentity,
  getAgent,
  getRepoContext,
  isAgentCaller,
} from "../../src/core/context";

function git(args: string[], cwd: string) {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString()}`);
  }
  return result.stdout.toString().trim();
}

function initRepo(dir: string, { branch = "main" }: { branch?: string } = {}) {
  git(["init", "-q", "-b", branch], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  writeFileSync(join(dir, "README.md"), "hello");
  git(["add", "."], dir);
  git(["commit", "-q", "-m", "init"], dir);
}

describe("core/context", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cairn-context-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("outside any git repo, all fields are null", () => {
    const ctx = getRepoContext(tmpDir);
    expect(ctx).toEqual({ repoId: null, repoRoot: null, branch: null });
  });

  test("inside a repo with no remote, repoId falls back to the repo root path", () => {
    initRepo(tmpDir);
    const ctx = getRepoContext(tmpDir);
    const realRoot = git(["rev-parse", "--show-toplevel"], tmpDir);
    expect(ctx.repoRoot).toBe(realRoot);
    expect(ctx.repoId).toBe(realRoot);
    expect(ctx.branch).toBe("main");
  });

  test("inside a repo with a remote, repoId is the remote origin URL", () => {
    initRepo(tmpDir);
    git(["remote", "add", "origin", "https://example.com/samudra/cairn.git"], tmpDir);
    const ctx = getRepoContext(tmpDir);
    expect(ctx.repoId).toBe("https://example.com/samudra/cairn.git");
  });

  test("a worktree shares repoId with its main checkout but has its own branch", () => {
    initRepo(tmpDir);
    git(["remote", "add", "origin", "https://example.com/samudra/cairn.git"], tmpDir);

    const worktreeDir = join(tmpDir, "..", `${tmpDir.split("/").pop()}-wt`);
    git(["worktree", "add", "-b", "feat/x", worktreeDir], tmpDir);

    const mainCtx = getRepoContext(tmpDir);
    const worktreeCtx = getRepoContext(worktreeDir);

    expect(worktreeCtx.repoId).toBe(mainCtx.repoId);
    expect(worktreeCtx.branch).toBe("feat/x");
    expect(mainCtx.branch).toBe("main");

    rmSync(worktreeDir, { recursive: true, force: true });
  });

  test("getAgent / isAgentCaller / callerIdentity reflect CAIRN_AGENT", () => {
    const prior = process.env.CAIRN_AGENT;
    try {
      delete process.env.CAIRN_AGENT;
      expect(getAgent()).toBeNull();
      expect(isAgentCaller()).toBe(false);
      expect(callerIdentity()).toBe("me");

      process.env.CAIRN_AGENT = "claude";
      expect(getAgent()).toBe("claude");
      expect(isAgentCaller()).toBe(true);
      expect(callerIdentity()).toBe("claude");
    } finally {
      if (prior === undefined) delete process.env.CAIRN_AGENT;
      else process.env.CAIRN_AGENT = prior;
    }
  });

  test("a corrupted .git throws GitCommandError rather than silently treating it as 'outside a repo'", () => {
    initRepo(tmpDir);
    // Corrupt .git/config so git fails with "bad config line", not the
    // "not a git repository" message that means "there's no repo here at
    // all" — these must be distinguished rather than both treated as null.
    writeFileSync(join(tmpDir, ".git", "config"), "[garbage\n");
    expect(() => getRepoContext(tmpDir)).toThrow(GitCommandError);
  });
});
