import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "ink";
import { App } from "../../src/tui/App";

/**
 * Proves the component tree mounts and renders real task data without
 * crashing. It does NOT simulate keypresses (j/k/enter/tab) — that needs
 * ink-testing-library's stdin mocking, which isn't an approved dependency
 * for this pass. Keyboard navigation is checked manually (see the plan's
 * manual walkthrough).
 */
describe("tui/App smoke test", () => {
  // App -> useTasksData calls core/db.openDb() with no path override, which
  // falls back to the real ~/.cairn/cairn.db whenever CAIRN_DB_PATH isn't
  // set. Force an isolated temp DB for this test regardless of ambient env
  // state, so running `bun test` never touches a real user's database.
  let tmpDir: string;
  let priorDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cairn-tui-smoke-"));
    priorDbPath = process.env.CAIRN_DB_PATH;
    process.env.CAIRN_DB_PATH = join(tmpDir, "smoke.db");
  });

  afterEach(() => {
    if (priorDbPath === undefined) delete process.env.CAIRN_DB_PATH;
    else process.env.CAIRN_DB_PATH = priorDbPath;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("renders without crashing", async () => {
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream;
    (stdout as unknown as { columns: number }).columns = 80;
    let output = "";
    stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    const instance = render(createElement(App), { stdout, exitOnCtrlC: false });
    await new Promise((r) => setTimeout(r, 100));

    expect(output.length).toBeGreaterThan(0);
    instance.unmount();
  });
});
