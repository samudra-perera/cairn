import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { TaskNotFoundError, completeTask } from "../../core/tasks";
import { recordCommits } from "../../core/commits";
import { getBranchCommits } from "../../core/git";

const optionsSchema = z.object({
  summary: z.string().min(1, "--summary is required"),
});

export function registerDoneCommand(program: Command): void {
  program
    .command("done <id>")
    .description("complete a task — agents move it to review, the human finalizes it to done")
    .requiredOption("--summary <text>", "what changed, why, and any gotchas")
    .action((idArg: string, rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);
      const options = optionsSchema.parse(rawOptions);

      try {
        const task = completeTask(ctx.db, id, ctx.actor, ctx.isAgent, options.summary);

        // Only from the task's own repo and branch: anywhere else, HEAD's commits
        // aren't this task's work.
        const onTaskBranch =
          ctx.repoRoot !== null && task.repo === ctx.repo && task.branch === ctx.branch;
        const commits =
          onTaskBranch && ctx.repoRoot
            ? recordCommits(ctx.db, id, ctx.actor, getBranchCommits(ctx.repoRoot))
            : [];

        emit(ctx, { ...task, commits }, (t) => {
          console.log(`#${t.id} -> ${t.status}`);
          if (t.commits.length > 0) {
            console.log(`recorded ${t.commits.length} commit${t.commits.length === 1 ? "" : "s"}`);
          }
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
