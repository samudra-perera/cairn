import type { CliContext } from "./context";
import { type Notification, getNewNotifications, markSeen } from "../core/notify";

/**
 * The single place that decides JSON vs. human formatting and handles
 * piggyback notifications. Every command calls this exactly once with its
 * final result instead of branching on ctx.json itself.
 */
export function emit<T>(ctx: CliContext, result: T, printHuman: (result: T) => void): void {
  let notifications: Notification[] = [];
  if (ctx.isAgent && ctx.agent) {
    notifications = getNewNotifications(ctx.db, ctx.agent);
  }

  if (ctx.json) {
    const payload: { data: T; notifications?: Notification[] } = { data: result };
    if (notifications.length > 0) payload.notifications = notifications;
    console.log(JSON.stringify(payload, null, 2));
  } else {
    for (const n of notifications) {
      console.log(`💬 ${n.message}`);
    }
    printHuman(result);
  }

  if (ctx.isAgent && ctx.agent) {
    markSeen(ctx.db, ctx.agent);
  }
}

/** Prints a clean, single-line error (respecting --json) and exits 1. */
export function fail(ctx: CliContext, message: string): never {
  if (ctx.json) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(`✗ ${message}`);
  }
  process.exit(1);
}
