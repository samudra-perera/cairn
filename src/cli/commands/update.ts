import type { Command } from "commander";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { captureBranchCommits, describeCommitCount } from "../commits";
import { resolveTaskId } from "../resolveTask";
import { TaskNotFoundError, getTask } from "../../core/tasks";
import { addNote } from "../../core/notes";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update [id]")
    .description(
      "checkpoint a task (defaults to the one on this branch): record new commits and an optional note",
    )
    .option("--note <text>", "where you left off, decisions, what's next")
    .action((idArg: string | undefined, rawOptions: { note?: string }, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = resolveTaskId(ctx, idArg);

      const note = rawOptions.note?.trim();
      if (rawOptions.note !== undefined && !note) fail(ctx, "note can't be empty");

      try {
        const task = getTask(ctx.db, id);
        const commits = captureBranchCommits(ctx, task);
        if (note) {
          addNote(ctx.db, {
            taskId: id,
            repo: ctx.repo,
            branch: ctx.branch,
            author: ctx.actor,
            body: note,
            isAgent: ctx.isAgent,
          });
        }

        emit(ctx, { id, status: task.status, commits, noteAdded: Boolean(note) }, (r) => {
          const parts = [
            r.commits.length > 0 ? `recorded ${describeCommitCount(r.commits.length)}` : null,
            r.noteAdded ? "note added" : null,
          ].filter((p) => p !== null);
          console.log(
            parts.length > 0
              ? `#${r.id} updated: ${parts.join(", ")} [${r.status}]`
              : `#${r.id}: nothing new to record [${r.status}]`,
          );
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
