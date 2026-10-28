import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDiffStat, getLastCommitTime } from "../../src/core/git";

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
});
