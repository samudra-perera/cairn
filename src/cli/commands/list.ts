import type { Command } from "commander";
import { Option } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit } from "../output";
import { listTasks } from "../../core/tasks";

const optionsSchema = z.object({
  owner: z.string().optional(),
  status: z.enum(["todo", "doing", "review", "done"]).optional(),
  all: z.boolean().optional(),
  branch: z.boolean().optional(),
});

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("list tasks (defaults to the current repo + branch)")
    .addOption(new Option("--all", "show tasks across all repos and branches").conflicts("branch"))
    .addOption(new Option("--branch", "show only the current branch (default)").conflicts("all"))
    .option("--owner <owner>", "filter by owner")
    .option("--status <status>", "filter by status: todo|doing|review|done")
    .action((rawOptions: unknown, thisCommand: Command) => {
      const options = optionsSchema.parse(rawOptions);
      const ctx = buildCliContext(thisCommand.optsWithGlobals());

      const scope = options.all ? "all" : "branch";
      const tasks = listTasks(ctx.db, {
        repo: ctx.repo,
        branch: ctx.branch,
        scope,
        owner: options.owner,
        status: options.status,
      });

      emit(ctx, tasks, (items) => {
        if (items.length === 0) {
          console.log("No tasks.");
          return;
        }
        for (const t of items) {
          const claimed = t.claimedBy ? ` (${t.claimedBy})` : "";
          console.log(`#${t.id} [${t.status}]${claimed} ${t.title}`);
        }
      });
    });
}
