import type { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildCliContext } from "../context";
import { emit } from "../output";

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

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("write the agent workflow instructions into AGENTS.md and CLAUDE.md")
    .action((_rawOptions: unknown, thisCommand: Command) => {
      const ctx = buildCliContext(thisCommand.optsWithGlobals());
      upsertBlock("AGENTS.md");
      upsertBlock("CLAUDE.md");

      emit(ctx, { files: ["AGENTS.md", "CLAUDE.md"] }, ({ files }) => {
        console.log(`Wrote cairn workflow instructions to ${files.join(" and ")}.`);
      });
    });
}
