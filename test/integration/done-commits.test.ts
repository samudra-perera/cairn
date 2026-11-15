import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "../../src/index.ts");

describe("cairn done records branch commits", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cairn-done-commits-"));
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "t@example.com"]);
    git(["config", "user.name", "T"]);
    commit("init");
    git(["checkout", "-q", "-b", "feat/work"]);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function git(args: string[]) {
    const r = Bun.spawnSync(["git", ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  }
  function commit(message: string) {
    writeFileSync(join(dir, `${message.replace(/\W+/g, "-")}.txt`), message);
    git(["add", "."]);
    git(["commit", "-q", "-m", message]);
  }
  function cairn(args: string[], agent?: string) {
    const env: Record<string, string | undefined> = {
      ...process.env,
      CAIRN_DB_PATH: join(dir, ".cairn-test.db"),
      CAIRN_CONFIG_PATH: join(dir, ".cairn-test.json"),
      CAIRN_AGENT: agent,
    };
    if (!agent) delete env.CAIRN_AGENT;
    const r = Bun.spawnSync(["bun", ENTRY, ...args], { cwd: dir, env });
    return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
  }

  test("done records the branch's commits and show lists them", () => {
    cairn(["add", "the task"]);
    commit("add the parser");
    commit("handle empty input");

    const done = cairn(["done", "1", "--summary", "finished"]);
    expect(done.out).toContain("recorded 2 commits");

    const show = cairn(["show", "1"]).out;
    expect(show).toContain("commits:");
    expect(show).toMatch(/[0-9a-f]{7,} add the parser\n\s+[0-9a-f]{7,} handle empty input/);
    expect(show).toContain("recorded 2 commits");
  });

  test("done twice only records new commits, and --json carries them", () => {
    cairn(["add", "the task"]);
    commit("first");
    cairn(["done", "1", "--summary", "s"]);
    commit("second");

    const again = JSON.parse(cairn(["done", "1", "--summary", "s2", "--json"]).out);
    expect(again.data.commits.map((c: { subject: string }) => c.subject)).toEqual(["second"]);

    const show = JSON.parse(cairn(["show", "1", "--json"]).out);
    expect(show.data.commits.map((c: { subject: string }) => c.subject)).toEqual([
      "first",
      "second",
    ]);
  });

  test("an agent running done records them too", () => {
    cairn(["add", "the task"]);
    commit("agent work");
    expect(cairn(["done", "1", "--summary", "s"], "claude").out).toContain("recorded 1 commit");
  });

  test("no new commits means nothing is recorded or printed", () => {
    cairn(["add", "the task"]);
    const done = cairn(["done", "1", "--summary", "s"]);
    expect(done.out).not.toContain("recorded");
    expect(cairn(["show", "1"]).out).not.toContain("commits:");
  });

  test("done from a different branch than the task's records nothing", () => {
    cairn(["add", "the task"]); // belongs to feat/work
    git(["checkout", "-q", "-b", "feat/other"]);
    commit("unrelated work");
    expect(cairn(["done", "1", "--summary", "s"]).out).not.toContain("recorded");
  });
});
