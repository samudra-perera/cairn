import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { render } from "ink";
import { App } from "../../src/tui/App";
import { getSharedDb, resetSharedDb } from "../../src/tui/sharedDb";
import { addPersonalItem, listPersonalItems } from "../../src/core/personal";

function mount() {
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream;
  (stdout as unknown as { columns: number }).columns = 90;
  let output = "";
  stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const stdin = new PassThrough();
  Object.assign(stdin, { isTTY: true, setRawMode: () => {}, ref: () => {}, unref: () => {} });

  const instance = render(createElement(App), {
    stdout,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  return {
    instance,
    press: async (key: string) => {
      stdin.write(key);
      await new Promise((r) => setTimeout(r, 120));
    },
    getOutput: () => output,
    clearOutput: () => {
      output = "";
    },
  };
}

describe("tui personal view", () => {
  let tmpDir: string;
  let priorDbPath: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cairn-tui-personal-"));
    priorDbPath = process.env.CAIRN_DB_PATH;
    process.env.CAIRN_DB_PATH = join(tmpDir, "personal.db");
    resetSharedDb();
  });

  afterEach(() => {
    resetSharedDb();
    if (priorDbPath === undefined) delete process.env.CAIRN_DB_PATH;
    else process.env.CAIRN_DB_PATH = priorDbPath;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("p opens the list, x marks the selected item done, u undoes it, p returns", async () => {
    // The app reads through a module-level shared connection that is opened
    // once per process, so seed through that same connection.
    const db = getSharedDb();
    addPersonalItem(db, { title: "Apply to Acme" });
    addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });

    const { press, instance, getOutput, clearOutput } = mount();
    await new Promise((r) => setTimeout(r, 100));

    expect(getOutput()).not.toContain("Personal");

    await press("p");
    expect(getOutput()).toContain("Apply to Acme");
    expect(getOutput()).toContain("0/3 this week");

    await press("j");
    await press("x");
    expect(listPersonalItems(db).find((i) => i.title === "Gym")?.doneToday).toBe(true);

    await press("u");
    expect(listPersonalItems(db).find((i) => i.title === "Gym")?.doneToday).toBe(false);

    // d asks first: a non-y key cancels, y deletes the selected item.
    await press("d");
    expect(getOutput()).toContain("Delete");
    await press("n");
    expect(listPersonalItems(db)).toHaveLength(2);
    await press("d");
    await press("y");
    expect(listPersonalItems(db).map((i) => i.title)).toEqual(["Apply to Acme"]);

    // After deleting the last row the cursor lands on the new last item, so a
    // single x completes it without any extra key presses.
    await press("x");
    expect(listPersonalItems(db)[0]?.doneToday).toBe(true);

    clearOutput();
    await press("p");
    expect(getOutput()).toContain("Tasks - Current Branch");

    instance.unmount();
  });

  test("deleting a middle item leaves the cursor on the item that followed it", async () => {
    const db = getSharedDb();
    for (const title of ["one", "two", "three"]) addPersonalItem(db, { title });

    const { press, instance } = mount();
    await new Promise((r) => setTimeout(r, 100));
    await press("p");
    await press("j"); // on "two"
    await press("d");
    await press("y");
    await press("x"); // should complete "three", the item that slid up

    const done = listPersonalItems(db).filter((i) => i.doneToday);
    expect(done.map((i) => i.title)).toEqual(["three"]);
    instance.unmount();
  });
});
