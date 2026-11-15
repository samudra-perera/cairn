import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { TaskNotFoundError, completeTask } from "../../core/tasks";
import { captureBranchCommits, describeCommitCount } from "../commits";
import { resolveTaskId } from "../resolveTask";

const optionsSchema = z.object({
  summary: z.string().min(1, "--summary is required"),
});

export function registerDoneCommand(program: Command): void {
  program
    .command("done [id]")
    .description(
      "complete a task (defaults to the one on this branch) — agents move it to review, the human finalizes it to done",
    )
    .requiredOption("--summary <text>", "what changed, why, and any gotchas")
    .action((idArg: string | undefined, rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = resolveTaskId(ctx, idArg);
      const options = optionsSchema.parse(rawOptions);

      try {
        const task = completeTask(ctx.db, id, ctx.actor, ctx.isAgent, options.summary);

        const commits = captureBranchCommits(ctx, task);

        emit(ctx, { ...task, commits }, (t) => {
          console.log(`#${t.id} -> ${t.status}`);
          if (t.commits.length > 0) {
            console.log(`recorded ${describeCommitCount(t.commits.length)}`);
          }
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
