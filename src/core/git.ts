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

export interface BranchCommit {
  hash: string;
  subject: string;
}

const MAX_BRANCH_COMMITS = 50;

function refExists(repoRoot: string, ref: string): boolean {
  return run(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], repoRoot).code === 0;
}

function countAhead(repoRoot: string, base: string): number {
  const result = run(["rev-list", "--count", `${base}..HEAD`], repoRoot);
  return result.code === 0 ? parseInt(result.stdout, 10) : Number.POSITIVE_INFINITY;
}

/**
 * The commits on the current branch that aren't on the repo's main line,
 * oldest first. "The main line" is whichever of origin's default branch,
 * `main` or `master` leaves the fewest commits, so a stale local `main` (or a
 * stale `origin/main`) can't pull the main line's own commits into the list.
 * Returns [] on the main line itself, outside a repo, or when there's no base.
 */
export function getBranchCommits(repoRoot: string): BranchCommit[] {
  const originHead = run(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], repoRoot);
  const candidates = [originHead.code === 0 ? originHead.stdout : "", "main", "master"].filter(
    (ref) => ref.length > 0 && refExists(repoRoot, ref),
  );
  if (candidates.length === 0) return [];

  const base = candidates.reduce((best, ref) =>
    countAhead(repoRoot, ref) < countAhead(repoRoot, best) ? ref : best,
  );
  const log = run(
    ["log", "--reverse", `--max-count=${MAX_BRANCH_COMMITS}`, "--format=%h%x09%s", `${base}..HEAD`],
    repoRoot,
  );
  if (log.code !== 0 || log.stdout.length === 0) return [];

  return log.stdout.split("\n").map((line) => {
    const [hash = "", ...subject] = line.split("\t");
    return { hash, subject: subject.join("\t") };
  });
}
