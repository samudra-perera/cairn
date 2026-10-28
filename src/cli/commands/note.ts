import type { Command } from "commander";
import { z } from "zod";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { PrivateNoteForbiddenError, addNote } from "../../core/notes";

const optionsSchema = z.object({
  private: z.boolean().optional(),
});

/**
 * `cairn note "<text>"` (standalone) or `cairn note <id> "<text>"`
 * (attached). Commander can't express "optional leading numeric id" as a
 * typed positional, so this takes everything as variadic args and decides
 * based on whether the first token parses as an integer with more than one
 * token following it.
 */
function parseArgs(args: string[]): { taskId: number | null; body: string } {
  if (args.length >= 2 && /^\d+$/.test(args[0] ?? "")) {
    return { taskId: parseInt(args[0] as string, 10), body: args.slice(1).join(" ") };
  }
  return { taskId: null, body: args.join(" ") };
}

export function registerNoteCommand(program: Command): void {
  program
    .command("note <args...>")
    .description('add a note: `cairn note "text"` (standalone) or `cairn note <id> "text"` (on a task)')
    .option("--private", "hide this note from agents (humans only)")
    .action((args: string[], rawOptions: unknown, thisCommand: Command) => {
      const options = optionsSchema.parse(rawOptions);
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const { taskId, body } = parseArgs(args);

      try {
        const note = addNote(ctx.db, {
          taskId,
          repo: ctx.repo,
          branch: ctx.branch,
          author: ctx.agent ?? "me",
          body,
          private: options.private ?? false,
          isAgent: ctx.isAgent,
        });

        emit(ctx, note, (n) => {
          console.log(`note added${n.taskId ? ` to #${n.taskId}` : ""}${n.private ? " 🔒" : ""}`);
        });
      } catch (err) {
        if (err instanceof PrivateNoteForbiddenError) fail(ctx, err.message);
        throw err;
      }
    });
}
