import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { InvalidTransitionError, TaskNotFoundError, setStatus } from "../../core/tasks";

const statusSchema = z.enum(["todo", "doing", "review", "done"]);

export function registerStatusCommand(program: Command): void {
  program
    .command("status <id> <status>")
    .description("set a task's status (todo|doing|review|done) — agents can't set done directly")
    .action((idArg: string, statusArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);
      const parsed = statusSchema.safeParse(statusArg);
      if (!parsed.success) {
        fail(ctx, `status must be one of todo|doing|review|done, got "${statusArg}"`);
      }

      try {
        const task = setStatus(ctx.db, id, parsed.data, ctx.actor, ctx.isAgent);
        emit(ctx, task, (t) => {
          console.log(`#${t.id} status -> ${t.status}`);
        });
      } catch (err) {
        if (err instanceof InvalidTransitionError) fail(ctx, err.message);
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
