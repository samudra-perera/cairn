export interface DiffStat {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

function run(args: string[], cwd: string): { code: number; stdout: string } {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, stdout: result.stdout.toString().trim() };
}

export function getDiffStat(repoRoot: string, branch: string): DiffStat | null {
  const result = run(["diff", "--shortstat", `${branch}@{upstream}...${branch}`], repoRoot);
  const fallback = result.code !== 0 ? run(["diff", "--shortstat"], repoRoot) : result;
  if (fallback.code !== 0 || fallback.stdout.length === 0) return null;

  const filesChanged = /(\d+) files? changed/.exec(fallback.stdout);
  const insertions = /(\d+) insertions?\(\+\)/.exec(fallback.stdout);
  const deletions = /(\d+) deletions?\(-\)/.exec(fallback.stdout);

  return {
    filesChanged: filesChanged ? parseInt(filesChanged[1] ?? "0", 10) : 0,
    insertions: insertions ? parseInt(insertions[1] ?? "0", 10) : 0,
    deletions: deletions ? parseInt(deletions[1] ?? "0", 10) : 0,
  };
}

export function getLastCommitTime(repoRoot: string): string | null {
  const result = run(["log", "-1", "--format=%cI"], repoRoot);
  if (result.code !== 0 || result.stdout.length === 0) return null;
  return result.stdout;
}
