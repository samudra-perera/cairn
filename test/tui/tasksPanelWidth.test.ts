import { describe, expect, test } from "bun:test";
import { tasksPanelWidth } from "../../src/tui/TasksPanel";

describe("tui/tasksPanelWidth", () => {
  test("never goes below the minimum, so narrow terminals keep today's layout", () => {
    expect(tasksPanelWidth(60)).toBe(42);
    expect(tasksPanelWidth(80)).toBe(42);
  });

  test("takes 45% of the terminal in between", () => {
    expect(tasksPanelWidth(120)).toBe(54);
    expect(tasksPanelWidth(160)).toBe(72);
  });

  test("never goes above the maximum, so the detail panel keeps the rest", () => {
    expect(tasksPanelWidth(200)).toBe(80);
    expect(tasksPanelWidth(400)).toBe(80);
  });
});
