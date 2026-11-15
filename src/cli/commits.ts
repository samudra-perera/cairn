import type { CliContext } from "./context";
import type { Task } from "../core/tasks";
import { type BranchCommit, getBranchCommits } from "../core/git";
import { recordCommits } from "../core/commits";

/**
 * Records the current branch's new commits on `task` and returns them. Only
 * from the task's own repo and branch: anywhere else, HEAD's commits aren't
 * this task's work, so nothing is recorded.
 */
export function captureBranchCommits(ctx: CliContext, task: Task): BranchCommit[] {
  const onTaskBranch =
    ctx.repoRoot !== null && task.repo === ctx.repo && task.branch === ctx.branch;
  if (!onTaskBranch || !ctx.repoRoot) return [];
  return recordCommits(ctx.db, task.id, ctx.actor, getBranchCommits(ctx.repoRoot));
}

export function describeCommitCount(n: number): string {
  return `${n} commit${n === 1 ? "" : "s"}`;
}
