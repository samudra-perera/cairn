import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit } from "../output";
import { createTask } from "../../core/tasks";

const optionsSchema = z.object({
  owner: z.string().optional(),
  body: z.string().optional(),
  ref: z.array(z.number().int()).default([]),
});

export function registerAddCommand(program: Command): void {
  program
    .command("add <title>")
    .description("add a new task")
    .option("--owner <owner>", "who the task is for (defaults to 'me')")
    .option("--body <body>", "longer description")
    .option("--ref <id>", "reference another task by id (repeatable)", (val: string, prev: number[]) => {
      const n = parseInt(val, 10);
      if (Number.isNaN(n)) throw new Error(`--ref must be a number, got "${val}"`);
      return [...prev, n];
    }, [] as number[])
    .action((title: string, rawOptions: unknown, thisCommand: Command) => {
      const options = optionsSchema.parse(rawOptions);
      const ctx = buildCliContext(thisCommand.optsWithGlobals());

      const task = createTask(ctx.db, {
        title,
        body: options.body ?? null,
        owner: options.owner,
        repo: ctx.repo,
        branch: ctx.branch,
        createdBy: ctx.agent ?? "me",
        refs: options.ref,
      });

      emit(ctx, task, (t) => {
        console.log(`#${t.id} ${t.title} [${t.status}]`);
      });
    });
}
