import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { TaskNotFoundError, completeTask } from "../../core/tasks";

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
        const task = completeTask(ctx.db, id, ctx.agent ?? "me", ctx.isAgent, options.summary);
        emit(ctx, task, (t) => {
          console.log(`#${t.id} -> ${t.status}`);
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
