import type { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { buildCliContext } from "../context";
import { emit, fail } from "../output";
import { getUserName, setUserName } from "../../core/config";
import { validateName } from "../../core/names";

const START_MARKER = "<!-- cairn:start -->";
const END_MARKER = "<!-- cairn:end -->";

const WORKFLOW_BLOCK = `${START_MARKER}
## Using cairn

cairn is a shared task tracker and memory for this repo. It's used from the
shell with the \`cairn\` command. Set \`CAIRN_AGENT=<your name>\` (e.g. \`claude\`)
so your actions are attributed and you get piggyback notifications.

1. **Before starting:** \`cairn search "<topic>"\` for related past work, and read the summaries.
2. **Claim:** \`cairn claim <id>\`.
3. **While working:** \`cairn note <id> "<text>"\` for decisions, dead ends, or gotchas. Any new notes from the human print automatically before each command's output — read them.
4. **When finished:** \`cairn done <id> --summary "<text>"\` covering what changed, why, and any gotchas. This moves the task to review, not done — the human reviews and finalizes it.

Other commands: \`cairn list\` (tasks in the current repo+branch), \`cairn show <id>\` (full detail + timeline), \`cairn add "<title>"\` (create a task), \`cairn status <id> <status>\`. Every command supports \`--json\`.
${END_MARKER}`;

function upsertBlock(filePath: string): void {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  let next: string;
  if (startIdx !== -1 && endIdx !== -1) {
    next =
      existing.slice(0, startIdx) + WORKFLOW_BLOCK + existing.slice(endIdx + END_MARKER.length);
  } else if (existing.trim().length === 0) {
    next = `${WORKFLOW_BLOCK}\n`;
  } else {
    next = `${existing.trimEnd()}\n\n${WORKFLOW_BLOCK}\n`;
  }

  writeFileSync(filePath, next);
}

async function promptForName(current: string | null): Promise<string | null> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const suffix = current ? ` [${current}]` : "";
    const answer = (
      await rl.question(`Your name (shown on tasks and events you create)${suffix}: `)
    ).trim();
    return answer.length > 0 ? answer : current;
  } finally {
    rl.close();
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(
      "set your name and write the agent workflow instructions into AGENTS.md and CLAUDE.md",
    )
    .option("--name <name>", "your name, instead of being prompted")
    .action(async (rawOptions: { name?: string }, thisCommand: Command) => {
      const ctx = buildCliContext({ ...thisCommand.optsWithGlobals(), skipIdentityHint: true });

      const current = getUserName();
      let name = rawOptions.name?.trim() || null;
      if (rawOptions.name !== undefined) {
        const nameError = validateName(name ?? "");
        if (nameError) fail(ctx, nameError);
      } else if (process.stdin.isTTY) {
        name = await promptForName(current);
        const nameError = name ? validateName(name) : null;
        if (nameError) fail(ctx, nameError);
      }
      if (name) setUserName(name);

      upsertBlock("AGENTS.md");
      upsertBlock("CLAUDE.md");

      const saved = name ?? current;
      emit(ctx, { name: saved, files: ["AGENTS.md", "CLAUDE.md"] }, ({ name, files }) => {
        console.log(
          name ? `Hello, ${name}.` : "No name set; run `cairn init --name <name>` to set one.",
        );
        console.log(`Wrote cairn workflow instructions to ${files.join(" and ")}.`);
      });
    });
}
