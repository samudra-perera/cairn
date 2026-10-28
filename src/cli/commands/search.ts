import type { Command } from "commander";
import { Option } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit } from "../output";
import { searchTasks } from "../../core/search";

const optionsSchema = z.object({
  all: z.boolean().optional(),
  branch: z.boolean().optional(),
});

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description(
      "full-text search across tasks and notes (defaults to the whole repo, all branches)",
    )
    .addOption(new Option("--branch", "search only the current branch").conflicts("all"))
    .addOption(new Option("--all", "search across all repos").conflicts("branch"))
    .action((query: string, rawOptions: unknown, thisCommand: Command) => {
      const options = optionsSchema.parse(rawOptions);
      const ctx = buildCliContext(thisCommand.optsWithGlobals());

      const scope = options.all ? "all" : options.branch ? "branch" : "repo";
      const results = searchTasks(
        ctx.db,
        query,
        { repo: ctx.repo, branch: ctx.branch, scope },
        { asAgent: ctx.isAgent },
      );

      emit(ctx, results, (items) => {
        if (items.length === 0) {
          console.log("No matches.");
          return;
        }
        for (const r of items) {
          console.log(`#${r.taskId} [${r.kind}] ${r.snippet}`);
        }
      });
    });
}
