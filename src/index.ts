#!/usr/bin/env bun
export {};

if (process.argv.length <= 2) {
  const { renderTui } = await import("./tui/App");
  renderTui();
} else {
  const { buildProgram } = await import("./cli/program");
  buildProgram().parse(process.argv);
}
