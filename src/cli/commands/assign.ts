import type { Command } from "commander";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { assignTask } from "../../core/tasks";

export function registerAssignTaskCommand(program: Command): void {
  program
    .command("assign <id> <agent>")
    .description("assign a task to someone (does not change its status)")
    .action((idArg: string, agentArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);
      const actor = ctx.agent ?? "me";

      const assignee = agentArg.trim();
      if (assignee.length === 0) {
        fail(ctx, "agent name cannot be empty");
      }

      const result = assignTask(ctx.db, id, assignee, actor);
      if (!result.ok) {
        fail(ctx, `task ${id} not found`);
      }

      emit(ctx, result.task, (task) => {
        console.log(`#${task.id} assigned to ${task.claimedBy} by ${actor} [${task.status}]`);
      });
    });
}
