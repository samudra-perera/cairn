import { describe, expect, test } from "bun:test";
import {
  describeEvent,
  describePersonalItem,
  formatRelative,
  formatTimestamp,
} from "../../src/core/format";
import type { PersonalItemView } from "../../src/core/personal";
import type { Event } from "../../src/core/events";

const now = new Date("2026-10-28T20:05:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("core/format", () => {
  describe("formatRelative", () => {
    test("under a minute is 'just now'", () => {
      expect(formatRelative(ago(0), now)).toBe("just now");
      expect(formatRelative(ago(59 * SECOND), now)).toBe("just now");
    });

    test("a timestamp in the future is 'just now', not negative", () => {
      expect(formatRelative(new Date(now.getTime() + 3 * MINUTE), now)).toBe("just now");
    });

    test("minute boundary: 60s is 1m ago", () => {
      expect(formatRelative(ago(60 * SECOND), now)).toBe("1m ago");
      expect(formatRelative(ago(59 * MINUTE), now)).toBe("59m ago");
    });

    test("hour boundary: 60m is 1h ago", () => {
      expect(formatRelative(ago(60 * MINUTE), now)).toBe("1h ago");
      expect(formatRelative(ago(23 * HOUR), now)).toBe("23h ago");
    });

    test("day boundary: 24h is 1d ago", () => {
      expect(formatRelative(ago(24 * HOUR), now)).toBe("1d ago");
      expect(formatRelative(ago(3 * DAY), now)).toBe("3d ago");
    });
  });

  describe("formatTimestamp", () => {
    test("recent: absolute time plus relative", () => {
      const iso = ago(2 * HOUR).toISOString();
      expect(formatTimestamp(iso, now, "UTC")).toBe("Oct 28, 6:05 PM (2h ago)");
    });

    test("older than a week: absolute only", () => {
      const iso = ago(10 * DAY).toISOString();
      expect(formatTimestamp(iso, now, "UTC")).toBe("Oct 18, 8:05 PM");
    });

    test("exactly a week old drops the relative part; just under keeps it", () => {
      expect(formatTimestamp(ago(7 * DAY).toISOString(), now, "UTC")).toBe("Oct 21, 8:05 PM");
      expect(formatTimestamp(ago(7 * DAY - MINUTE).toISOString(), now, "UTC")).toBe(
        "Oct 21, 8:06 PM (6d ago)",
      );
    });

    test("includes the year when it differs from now's year", () => {
      expect(formatTimestamp("2025-03-02T09:30:00.000Z", now, "UTC")).toBe("Mar 2, 2025, 9:30 AM");
    });

    test("honors the timezone", () => {
      const iso = ago(2 * HOUR).toISOString();
      expect(formatTimestamp(iso, now, "America/New_York")).toBe("Oct 28, 2:05 PM (2h ago)");
    });

    test("an unparseable timestamp is returned unchanged", () => {
      expect(formatTimestamp("not a date", now, "UTC")).toBe("not a date");
    });
  });

  describe("describeEvent", () => {
    const ev = (kind: string, data: unknown): Event => ({
      id: 1,
      taskId: 1,
      actor: "me",
      kind,
      data,
      createdAt: "2026-10-28T20:05:00.000Z",
    });

    test("status shows from and to", () => {
      expect(describeEvent(ev("status", { from: "todo", to: "review" }))).toBe(
        "moved todo → review",
      );
    });

    test("assigned shows the assignee, and the previous one on reassignment", () => {
      expect(describeEvent(ev("assigned", { assignedTo: "claude", previous: null }))).toBe(
        "assigned to claude",
      );
      expect(describeEvent(ev("assigned", { assignedTo: "claude", previous: "pi" }))).toBe(
        "assigned to claude (was pi)",
      );
    });

    test("commits say how many were recorded", () => {
      const one = [{ hash: "abc1234", subject: "s" }];
      expect(describeEvent(ev("commits", { commits: one }))).toBe("recorded 1 commit");
      expect(describeEvent(ev("commits", { commits: [...one, ...one, ...one] }))).toBe(
        "recorded 3 commits",
      );
      expect(describeEvent(ev("commits", { commits: 5 }))).toBe("commits");
    });

    test("noted distinguishes private notes", () => {
      expect(describeEvent(ev("noted", { private: false }))).toBe("added a note");
      expect(describeEvent(ev("noted", { private: true }))).toBe("added a private note");
    });

    test("kinds without useful data have fixed descriptions", () => {
      expect(describeEvent(ev("created", { title: "t" }))).toBe("created the task");
      expect(describeEvent(ev("claimed", { claimedBy: "pi" }))).toBe("claimed it");
      expect(describeEvent(ev("edited", {}))).toBe("edited the task");
      expect(describeEvent(ev("summary", { summary: "s" }))).toBe("added a summary");
    });

    test("malformed or missing data falls back to the raw kind", () => {
      expect(describeEvent(ev("status", null))).toBe("status");
      expect(describeEvent(ev("status", { from: "todo" }))).toBe("status");
      expect(describeEvent(ev("assigned", { assignedTo: 5 }))).toBe("assigned");
    });

    test("an unknown kind is returned as is", () => {
      expect(describeEvent(ev("teleported", {}))).toBe("teleported");
    });
  });

  describe("describePersonalItem", () => {
    const view = (over: Partial<PersonalItemView>): PersonalItemView => ({
      id: 1,
      title: "t",
      targetPerWeek: 3,
      createdAt: "2026-11-01T00:00:00.000Z",
      doneToday: false,
      doneThisWeek: 0,
      streak: 0,
      settled: false,
      ...over,
    });

    test("recurring shows progress, plus streak and done-today when they apply", () => {
      expect(describePersonalItem(view({}))).toBe("0/3 this week");
      expect(describePersonalItem(view({ doneThisWeek: 1, streak: 2 }))).toBe(
        "1/3 this week · streak 2",
      );
      expect(describePersonalItem(view({ doneThisWeek: 2, doneToday: true, streak: 1 }))).toBe(
        "2/3 this week · streak 1 · done today",
      );
    });

    test("a one-off has no progress text until it's done", () => {
      expect(describePersonalItem(view({ targetPerWeek: null }))).toBe("");
      expect(describePersonalItem(view({ targetPerWeek: null, doneToday: true }))).toBe("done");
    });
  });
});
