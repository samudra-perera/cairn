export interface RepoContext {
  repoId: string | null;
  repoRoot: string | null;
  branch: string | null;
}

export class GitCommandError extends Error {}

function runGit(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

/**
 * Detects the current git repo root, branch, and a stable repo identity
 * (remote origin URL, falling back to the repo root path) from `cwd`.
 * Returns all-null fields when `cwd` isn't inside a git repo at all.
 */
export function getRepoContext(cwd: string = process.cwd()): RepoContext {
  const toplevel = runGit(["rev-parse", "--show-toplevel"], cwd);
  if (toplevel.code !== 0) {
    if (/not a git repository/i.test(toplevel.stderr)) {
      return { repoId: null, repoRoot: null, branch: null };
    }
    throw new GitCommandError(`git rev-parse --show-toplevel failed: ${toplevel.stderr}`);
  }
  const repoRoot = toplevel.stdout;

  const branchResult = runGit(["branch", "--show-current"], cwd);
  if (branchResult.code !== 0) {
    throw new GitCommandError(`git branch --show-current failed: ${branchResult.stderr}`);
  }
  const branch = branchResult.stdout.length > 0 ? branchResult.stdout : null;

  const remoteResult = runGit(["remote", "get-url", "origin"], cwd);
  const repoId =
    remoteResult.code === 0 && remoteResult.stdout.length > 0 ? remoteResult.stdout : repoRoot;

  return { repoId, repoRoot, branch };
}

export function getAgent(): string | null {
  const agent = process.env.CAIRN_AGENT?.trim();
  return agent && agent.length > 0 ? agent : null;
}

export function isAgentCaller(): boolean {
  return getAgent() !== null;
}

export function callerIdentity(): string {
  return getAgent() ?? "me";
}
