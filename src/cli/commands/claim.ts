import type { Command } from "commander";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { claimTask } from "../../core/tasks";

export function registerClaimCommand(program: Command): void {
  program
    .command("claim <id>")
    .description("claim a task (atomic — if two callers race, exactly one wins)")
    .action((idArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);
      const actor = ctx.actor;

      const result = claimTask(ctx.db, id, actor);
      if (!result.ok) {
        fail(
          ctx,
          result.reason === "not_found" ? `task ${id} not found` : `task ${id} is already claimed`,
        );
      }

      emit(ctx, result.task, (task) => {
        console.log(`#${task.id} claimed by ${task.claimedBy} [${task.status}]`);
      });
    });
}
