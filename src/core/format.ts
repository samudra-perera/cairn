import { z } from "zod";
import type { Event } from "./events";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const statusData = z.object({ from: z.string(), to: z.string() });
const assignedData = z.object({ assignedTo: z.string(), previous: z.string().nullable() });
const notedData = z.object({ private: z.boolean() });

/**
 * Turns an event into the part of a timeline line that follows the actor,
 * e.g. "moved todo → review". Event data is stored as unknown JSON, so each
 * kind is validated before use; anything unrecognised or malformed falls back
 * to the raw kind so an odd row can never break the timeline.
 */
export function describeEvent(event: Event): string {
  switch (event.kind) {
    case "created":
      return "created the task";
    case "claimed":
      return "claimed it";
    case "edited":
      return "edited the task";
    case "summary":
      return "added a summary";
    case "status": {
      const data = statusData.safeParse(event.data);
      return data.success ? `moved ${data.data.from} → ${data.data.to}` : event.kind;
    }
    case "assigned": {
      const data = assignedData.safeParse(event.data);
      if (!data.success) return event.kind;
      const was = data.data.previous ? ` (was ${data.data.previous})` : "";
      return `assigned to ${data.data.assignedTo}${was}`;
    }
    case "noted": {
      const data = notedData.safeParse(event.data);
      return data.success && data.data.private ? "added a private note" : "added a note";
    }
    default:
      return event.kind;
  }
}

export function formatRelative(then: Date, now: Date): string {
  const diff = now.getTime() - then.getTime();
  // Also covers timestamps in the future (clock skew) so we never print "-3m ago".
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

/**
 * Turns a stored ISO timestamp into e.g. "Oct 28, 8:05 PM (2h ago)".
 * The year is only shown when it differs from `now`'s year, and the relative
 * part is dropped after a week, where it stops being useful.
 * `now` and `timeZone` are parameters so tests are deterministic.
 */
export function formatTimestamp(iso: string, now: Date = new Date(), timeZone?: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;

  const yearOf = (d: Date) => d.toLocaleString("en-US", { year: "numeric", timeZone });
  const sameYear = yearOf(then) === yearOf(now);

  // Date and time are formatted separately: combined, Intl joins them with
  // "at" or "," depending on the runtime's locale data.
  const date = then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone,
  });
  const time = then.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  // Newer ICU versions put a narrow no-break space before AM/PM.
  const absolute = `${date}, ${time}`.replace(/\s/g, " ");

  const age = now.getTime() - then.getTime();
  return age >= WEEK ? absolute : `${absolute} (${formatRelative(then, now)})`;
}
