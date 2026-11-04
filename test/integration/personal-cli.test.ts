import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "../../src/index.ts");

describe("cairn me (CLI)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cairn-me-cli-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function cairn(args: string[], agent?: string) {
    const env: Record<string, string | undefined> = {
      ...process.env,
      CAIRN_DB_PATH: join(tmpDir, "cli.db"),
      CAIRN_CONFIG_PATH: join(tmpDir, "config.json"),
      CAIRN_AGENT: agent,
    };
    if (!agent) delete env.CAIRN_AGENT;
    const result = Bun.spawnSync(["bun", ENTRY, ...args], { cwd: tmpDir, env });
    return {
      code: result.exitCode,
      out: result.stdout.toString(),
      err: result.stderr.toString(),
    };
  }

  test("a human can add, complete, list and undo", () => {
    expect(cairn(["me", "add", "Gym", "--weekly", "3"]).code).toBe(0);
    expect(cairn(["me", "done", "1"]).out).toContain("1/3 this week");
    expect(cairn(["me", "list"]).out).toContain("Gym");
    expect(cairn(["me", "undo", "1"]).code).toBe(0);
  });

  test("a weekly target outside 1-7 is rejected", () => {
    const result = cairn(["me", "add", "x", "--weekly", "9"]);
    expect(result.code).toBe(1);
    expect(result.err).toContain("1 to 7");
  });

  test("an agent can add but can't list, complete or undo", () => {
    expect(cairn(["me", "add", "Book dentist"], "claude").code).toBe(0);
    for (const args of [
      ["me", "list"],
      ["me", "done", "1"],
      ["me", "undo", "1"],
    ]) {
      const result = cairn(args, "claude");
      expect(result.code).toBe(1);
      expect(result.err).toContain("private");
    }
    // What the agent added is there for the human.
    expect(cairn(["me", "list"]).out).toContain("Book dentist");
  });

  test("a human can edit the title and weekly target", () => {
    cairn(["me", "add", "Gym", "--weekly", "3"]);
    const retitled = cairn(["me", "edit", "1", "--title", "Lift"]);
    expect(retitled.out).toContain("Lift (3x per week)");
    expect(cairn(["me", "edit", "1", "--weekly", "4"]).out).toContain("(4x per week)");
    const once = cairn(["me", "edit", "1", "--once"]);
    expect(once.out).toContain("#1 Lift");
    expect(once.out).not.toContain("per week");
  });

  test("edit rejects an empty change, a bad target, conflicting flags and unknown ids", () => {
    cairn(["me", "add", "Gym"]);
    expect(cairn(["me", "edit", "1"]).err).toContain("nothing to change");
    expect(cairn(["me", "edit", "1", "--weekly", "9"]).err).toContain("1 to 7");
    expect(cairn(["me", "edit", "1", "--weekly", "2", "--once"]).code).toBe(1);
    expect(cairn(["me", "edit", "99", "--title", "x"]).err).toContain("not found");
  });

  test("delete needs --yes when it can't prompt; unknown ids fail", () => {
    cairn(["me", "add", "Gym"]);
    const refused = cairn(["me", "delete", "1"]);
    expect(refused.code).toBe(1);
    expect(refused.err).toContain("--yes");
    expect(cairn(["me", "list"]).out).toContain("Gym");

    expect(cairn(["me", "delete", "1", "--yes"]).out).toContain("deleted");
    expect(cairn(["me", "list"]).out).toContain("Nothing on your personal list");
    expect(cairn(["me", "delete", "1", "--yes"]).err).toContain("not found");
  });

  test("agents can't edit or delete", () => {
    cairn(["me", "add", "Gym"]);
    for (const args of [
      ["me", "edit", "1", "--title", "x"],
      ["me", "delete", "1", "--yes"],
    ]) {
      const result = cairn(args, "claude");
      expect(result.code).toBe(1);
      expect(result.err).toContain("private");
    }
    expect(cairn(["me", "list"]).out).toContain("Gym");
  });
});
