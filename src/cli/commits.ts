import type { CliContext } from "./context";
import type { Task } from "../core/tasks";
import { type BranchCommit, getBranchCommits } from "../core/git";
import { recordCommits } from "../core/commits";

/**
 * Records the current branch's new commits on `task` and returns them. Only
 * from the task's own repo. The branch needn't match: a task is usually
 * created on one branch (often main) and worked on another, and the commits
 * that count are the ones not on the main line yet.
 */
export function captureBranchCommits(ctx: CliContext, task: Task): BranchCommit[] {
  if (!ctx.repoRoot || task.repo !== ctx.repo) return [];
  return recordCommits(ctx.db, task.id, ctx.actor, getBranchCommits(ctx.repoRoot));
}

export function describeCommitCount(n: number): string {
  return `${n} commit${n === 1 ? "" : "s"}`;
}
