import type { Command } from "commander";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { TaskNotFoundError, getTask, updateTaskContent } from "../../core/tasks";

function parseMarkdown(content: string): { title: string; body: string | null } {
  const lines = content.split("\n");
  let title = "";
  let bodyStart = 0;

  if (lines[0]?.startsWith("# ")) {
    title = lines[0].slice(2).trim();
    bodyStart = 1;
  }
  while (bodyStart < lines.length && (lines[bodyStart]?.trim() ?? "") === "") bodyStart++;

  const body = lines.slice(bodyStart).join("\n").trimEnd();
  return { title, body: body.length > 0 ? body : null };
}

export function registerEditCommand(program: Command): void {
  program
    .command("edit <id>")
    .description("edit a task's title/body in $EDITOR")
    .action((idArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const id = parseInt(idArg, 10);

      try {
        const task = getTask(ctx.db, id);
        const tmpPath = join(tmpdir(), `cairn-edit-${id}-${Date.now()}.md`);
        writeFileSync(tmpPath, `# ${task.title}\n\n${task.body ?? ""}\n`);

        const editor = process.env.EDITOR ?? "vi";
        const result = Bun.spawnSync([editor, tmpPath], {
          stdio: ["inherit", "inherit", "inherit"],
        });
        if (result.exitCode !== 0) {
          rmSync(tmpPath, { force: true });
          fail(ctx, `editor exited with code ${result.exitCode}`);
        }

        const content = readFileSync(tmpPath, "utf-8");
        rmSync(tmpPath, { force: true });

        const { title, body } = parseMarkdown(content);
        if (!title) fail(ctx, "title cannot be empty");

        const updated = updateTaskContent(ctx.db, id, { title, body }, ctx.actor);
        emit(ctx, updated, (t) => {
          console.log(`#${t.id} updated`);
        });
      } catch (err) {
        if (err instanceof TaskNotFoundError) fail(ctx, err.message);
        throw err;
      }
    });
}
