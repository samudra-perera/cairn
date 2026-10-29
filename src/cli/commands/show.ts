import type { Command } from "commander";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { TaskNotFoundError, getTask } from "../../core/tasks";
import { listEvents } from "../../core/events";
import { listNotesForTask } from "../../core/notes";
import { describeEvent, formatTimestamp } from "../../core/format";

export function registerShowCommand(program: Command): void {
  program
    .command("show <id>")
    .description("show a task, its notes, and its event timeline")
    .action((idArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);

      try {
        const task = getTask(ctx.db, id);
        const notes = listNotesForTask(ctx.db, id, { asAgent: ctx.isAgent });
        const events = listEvents(ctx.db, id);

        emit(ctx, { task, notes, events }, ({ task, notes, events }) => {
          console.log(`#${task.id} ${task.title} [${task.status}]`);
          if (task.body) console.log(task.body);
          if (task.summary) console.log(`\nsummary: ${task.summary}`);
          console.log(`\nnotes:`);
          for (const n of notes) {
            console.log(
              `  ${formatTimestamp(n.createdAt)} ${n.author}${n.private ? " 🔒" : ""}: ${n.body}`,
            );
          }
          console.log(`\ntimeline:`);
          for (const e of events) {
            console.log(`  ${formatTimestamp(e.createdAt)} ${e.actor} ${describeEvent(e)}`);
          }
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
