import { Command } from "commander";
import { registerAddCommand } from "./commands/add";
import { registerListCommand } from "./commands/list";
import { registerShowCommand } from "./commands/show";
import { registerClaimCommand } from "./commands/claim";
import { registerStatusCommand } from "./commands/status";
import { registerNoteCommand } from "./commands/note";
import { registerDoneCommand } from "./commands/done";
import { registerSearchCommand } from "./commands/search";
import { registerEditCommand } from "./commands/edit";
import { registerInitCommand } from "./commands/init";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("cairn")
    .description("a terminal task manager and shared memory for you and your coding agents")
    .option("--json", "output machine-readable JSON instead of human-readable text");

  registerAddCommand(program);
  registerListCommand(program);
  registerShowCommand(program);
  registerClaimCommand(program);
  registerStatusCommand(program);
  registerNoteCommand(program);
  registerDoneCommand(program);
  registerSearchCommand(program);
  registerEditCommand(program);
  registerInitCommand(program);

  return program;
}
