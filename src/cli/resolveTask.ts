import type { CliContext } from "./context";
import { fail } from "./output";
import { findCurrentTask } from "../core/tasks";

/**
 * The task id a command should act on: the one given, or, when it's left off,
 * the task being worked on (see findCurrentTask). When inferred, says which on
 * stderr, so it's visible without disturbing stdout or --json output.
 */
export function resolveTaskId(ctx: CliContext, idArg: string | undefined): number {
  if (idArg !== undefined) {
    const id = parseInt(idArg, 10);
    if (Number.isNaN(id)) fail(ctx, `"${idArg}" is not a valid id`);
    return id;
  }

  const found = findCurrentTask(ctx.db, {
    repo: ctx.repo,
    branch: ctx.branch,
    actor: ctx.actor,
  });
  if (!found.ok) {
    if (found.reason === "ambiguous") {
      const list = found.candidates.map((t) => `#${t.id} ${t.title}`).join(", ");
      fail(ctx, `more than one task fits (${list}); pass a task id`);
    }
    fail(ctx, "no task to infer from this branch; pass a task id");
  }
  if (!ctx.json) {
    const how = found.via === "branch" ? "on this branch" : "the one you have in progress";
    console.error(`using #${found.task.id} "${found.task.title}" (${how})`);
  }
  return found.task.id;
}
