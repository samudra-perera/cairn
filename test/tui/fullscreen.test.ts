import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { createElement } from "react";
import { Box, Text, render } from "ink";
import { enterAltScreen } from "../../src/tui/altScreen";
import { FullScreen } from "../../src/tui/FullScreen";

const ENTER = "\x1b[?1049h";
const LEAVE = "\x1b[?1049l";

function fakeStdout(opts: { isTTY: boolean; columns?: number; rows?: number }) {
  const stdout = new PassThrough();
  Object.assign(stdout, opts);
  const chunks: string[] = [];
  stdout.on("data", (c: Buffer) => chunks.push(c.toString()));
  return { stdout: stdout as unknown as NodeJS.WriteStream, chunks, raw: stdout };
}

describe("tui/altScreen", () => {
  test("enters the alternate screen, and restore leaves it exactly once", () => {
    const { stdout, chunks } = fakeStdout({ isTTY: true });
    const restore = enterAltScreen(stdout);
    expect(chunks.join("")).toContain(ENTER);

    restore();
    restore();
    const leaves = chunks.join("").split(LEAVE).length - 1;
    expect(leaves).toBe(1);
  });

  test("restores when the process exits, so a crash can't leave the terminal broken", () => {
    const { stdout, chunks } = fakeStdout({ isTTY: true });
    enterAltScreen(stdout);
    process.emit("exit", 0);
    expect(chunks.join("")).toContain(LEAVE);
  });

  test("does nothing when stdout isn't a terminal", () => {
    const { stdout, chunks } = fakeStdout({ isTTY: false });
    const restore = enterAltScreen(stdout);
    restore();
    expect(chunks).toEqual([]);
  });
});

describe("tui/FullScreen", () => {
  // The last frame Ink drew (the last chunk containing the box's border),
  // without cursor/erase escapes, as its lines.
  const lastFrame = (chunks: string[]) => {
    const frame = chunks.filter((c) => c.includes("┌")).at(-1) ?? "";
    return frame
      .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
      .replace(/\n$/, "")
      .split("\n");
  };

  const mount = (stdout: NodeJS.WriteStream) =>
    render(
      createElement(
        FullScreen,
        null,
        createElement(Box, { borderStyle: "single", flexGrow: 1 }, createElement(Text, null, "hi")),
      ),
      { stdout, exitOnCtrlC: false, patchConsole: false },
    );

  test("fills the terminal height, minus one spare row", async () => {
    const { stdout, chunks } = fakeStdout({ isTTY: true, columns: 40, rows: 12 });
    const instance = mount(stdout);
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame(chunks)).toHaveLength(11);
    instance.unmount();
  });

  test("re-lays out when the terminal is resized", async () => {
    const { stdout, chunks, raw } = fakeStdout({ isTTY: true, columns: 40, rows: 12 });
    const instance = mount(stdout);
    await new Promise((r) => setTimeout(r, 50));

    Object.assign(raw, { rows: 8, columns: 30 });
    raw.emit("resize");
    await new Promise((r) => setTimeout(r, 50));

    const frame = lastFrame(chunks);
    expect(frame).toHaveLength(7);
    expect(frame[0]).toHaveLength(30);
    instance.unmount();
  });

  test("falls back to 80x24 when the terminal reports no size", async () => {
    const { stdout, chunks } = fakeStdout({ isTTY: true });
    const instance = mount(stdout);
    await new Promise((r) => setTimeout(r, 50));

    const frame = lastFrame(chunks);
    expect(frame).toHaveLength(23);
    expect(frame[0]).toHaveLength(80);
    instance.unmount();
  });
});
