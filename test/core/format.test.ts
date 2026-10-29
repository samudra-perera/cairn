import { describe, expect, test } from "bun:test";
import { formatRelative, formatTimestamp } from "../../src/core/format";

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
});
