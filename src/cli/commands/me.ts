import type { Command } from "commander";
import { Option } from "commander";
import { z } from "zod";
import { buildCliContext, type CliContext } from "../context";
import { emit, fail } from "../output";
import { confirm } from "../prompt";
import {
  addPersonalItem,
  completePersonalItem,
  deletePersonalItem,
  editPersonalItem,
  getPersonalItem,
  listPersonalItems,
  undoPersonalItem,
  type PersonalItem,
} from "../../core/personal";
import { describePersonalItem } from "../../core/format";

const addOptionsSchema = z.object({
  weekly: z.number().int().min(1).max(7).optional(),
});

const editOptionsSchema = z.object({
  title: z.string().optional(),
  weekly: z.number().int().min(1).max(7).optional(),
  once: z.boolean().optional(),
});

/** The personal list is private to the human: agents may add to it, nothing else. */
function requireHuman(ctx: CliContext): void {
  if (ctx.isAgent) fail(ctx, "the personal list is private; agents can only use `cairn me add`");
}

function printItem(item: PersonalItem): void {
  const weekly = item.targetPerWeek ? ` (${item.targetPerWeek}x per week)` : "";
  console.log(`#${item.id} ${item.title}${weekly}`);
}

function parseId(ctx: CliContext, idArg: string): number {
  const id = parseInt(idArg, 10);
  if (Number.isNaN(id)) fail(ctx, `"${idArg}" is not a valid id`);
  return id;
}

export function registerMeCommand(program: Command): void {
  const me = program
    .command("me")
    .description("your personal list: errands, applications, recurring habits");

  me.command("add <title>")
    .description("add a personal item (agents may use this to add one for you)")
    .option("--weekly <n>", "recurring: wanted completions per week (Mon-Sun), 1-7", (val) => {
      const n = parseInt(val, 10);
      if (Number.isNaN(n)) throw new Error(`--weekly must be a number, got "${val}"`);
      return n;
    })
    .action((title: string, rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      const parsed = addOptionsSchema.safeParse(rawOptions);
      if (!parsed.success) fail(ctx, "--weekly must be a whole number from 1 to 7");
      if (title.trim().length === 0) fail(ctx, "title can't be empty");

      const item = addPersonalItem(ctx.db, {
        title: title.trim(),
        targetPerWeek: parsed.data.weekly,
      });

      // Agents get a bare acknowledgement: they can add, but not read the list back.
      if (ctx.isAgent) {
        emit(ctx, { id: item.id }, ({ id }) => console.log(`added personal item #${id}`));
        return;
      }
      emit(ctx, item, printItem);
    });

  me.command("list")
    .description("show your personal list")
    .action((_rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      requireHuman(ctx);

      emit(ctx, listPersonalItems(ctx.db), (items) => {
        if (items.length === 0) {
          console.log("Nothing on your personal list.");
          return;
        }
        for (const item of items) {
          const progress = describePersonalItem(item);
          const mark = item.settled ? "[x]" : "[ ]";
          console.log(`#${item.id} ${mark} ${item.title}${progress ? `  ${progress}` : ""}`);
        }
      });
    });

  me.command("done <id>")
    .description("mark a personal item done for today")
    .action((idArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      requireHuman(ctx);
      const id = parseId(ctx, idArg);

      const result = completePersonalItem(ctx.db, id);
      if (!result.ok) {
        fail(
          ctx,
          result.reason === "not_found"
            ? `personal item ${id} not found`
            : `personal item ${id} is already done`,
        );
      }
      const item = listPersonalItems(ctx.db).find((i) => i.id === id);
      emit(ctx, item ?? { id }, () => {
        const progress = item ? describePersonalItem(item) : "";
        console.log(`#${id} done${progress ? `  ${progress}` : ""}`);
      });
    });

  me.command("undo <id>")
    .description("undo today's completion of a personal item")
    .action((idArg: string, _rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      requireHuman(ctx);
      const id = parseId(ctx, idArg);

      const result = undoPersonalItem(ctx.db, id);
      if (!result.ok) {
        fail(
          ctx,
          result.reason === "not_found"
            ? `personal item ${id} not found`
            : `personal item ${id} wasn't done today`,
        );
      }
      emit(ctx, { id }, () => console.log(`#${id} reopened`));
    });

  me.command("edit <id>")
    .description("change a personal item's title or weekly target")
    .option("--title <title>", "new title")
    .addOption(
      new Option("--weekly <n>", "make it recurring with this many completions per week, 1-7")
        .argParser((val) => parseInt(val, 10))
        .conflicts("once"),
    )
    .addOption(new Option("--once", "make it a one-off item").conflicts("weekly"))
    .action((idArg: string, rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      requireHuman(ctx);
      const id = parseId(ctx, idArg);

      const parsed = editOptionsSchema.safeParse(rawOptions);
      if (!parsed.success) fail(ctx, "--weekly must be a whole number from 1 to 7");
      const { title, weekly, once } = parsed.data;
      if (title !== undefined && title.trim().length === 0) fail(ctx, "title can't be empty");
      if (title === undefined && weekly === undefined && !once) {
        fail(ctx, "nothing to change: pass --title, --weekly <n> or --once");
      }

      const result = editPersonalItem(ctx.db, id, {
        title: title?.trim(),
        targetPerWeek: once ? null : weekly,
      });
      if (!result.ok) fail(ctx, `personal item ${id} not found`);

      emit(ctx, result.item, printItem);
    });

  me.command("delete <id>")
    .description("permanently delete a personal item and its history (asks first)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (idArg: string, rawOptions: { yes?: boolean }, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      requireHuman(ctx);
      const id = parseId(ctx, idArg);

      const item = getPersonalItem(ctx.db, id);
      if (!item) fail(ctx, `personal item ${id} not found`);

      if (!rawOptions.yes) {
        if (ctx.json || !process.stdin.isTTY) {
          fail(ctx, "can't ask for confirmation here; pass --yes to delete");
        }
        const ok = await confirm(`Delete #${id} "${item.title}" and its history?`);
        if (!ok) {
          console.log("Cancelled.");
          return;
        }
      }

      const result = deletePersonalItem(ctx.db, id);
      if (!result.ok) fail(ctx, `personal item ${id} not found`);
      emit(ctx, { id }, () => console.log(`#${id} deleted`));
    });
}
