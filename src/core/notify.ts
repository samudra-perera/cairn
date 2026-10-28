import type { Database } from "bun:sqlite";
import { filterPrivate } from "./notes";

export interface Notification {
  kind: "note" | "status" | "summary";
  taskId: number | null;
  message: string;
  createdAt: string;
}

const EPOCH = new Date(0).toISOString();

interface AgentSeenRow {
  last_seen_at: string;
}

function getLastSeen(db: Database, agent: string): string {
  const row = db
    .query<AgentSeenRow, [string]>(`SELECT last_seen_at FROM agent_seen WHERE agent = ?`)
    .get(agent);
  return row?.last_seen_at ?? EPOCH;
}

interface NoteNotifyRow {
  task_id: number | null;
  author: string;
  body: string;
  private: number;
  created_at: string;
}

interface EventNotifyRow {
  task_id: number | null;
  actor: string;
  kind: string;
  data: string | null;
  created_at: string;
}

/**
 * Computes notifications for `agent` not yet marked seen. The caller here is
 * always an agent (humans don't poll piggyback notifications), but notes
 * still go through `filterPrivate` explicitly rather than assuming that.
 */
export function getNewNotifications(db: Database, agent: string): Notification[] {
  const lastSeen = getLastSeen(db, agent);

  const noteRows = db
    .query<NoteNotifyRow, [string, string]>(
      `SELECT task_id, author, body, private, created_at
       FROM notes
       WHERE created_at > ? AND author != ?
       ORDER BY created_at ASC`,
    )
    .all(lastSeen, agent);

  const noteNotifications: Notification[] = filterPrivate(
    noteRows.map((r) => ({
      taskId: r.task_id,
      author: r.author,
      body: r.body,
      private: r.private === 1,
      createdAt: r.created_at,
    })),
    true,
  ).map((r) => ({
    kind: "note" as const,
    taskId: r.taskId,
    message:
      r.taskId !== null
        ? `note from ${r.author} on #${r.taskId}: "${r.body}"`
        : `note from ${r.author}: "${r.body}"`,
    createdAt: r.createdAt,
  }));

  const eventRows = db
    .query<EventNotifyRow, [string, string]>(
      `SELECT task_id, actor, kind, data, created_at
       FROM events
       WHERE created_at > ? AND actor != ? AND kind IN ('status', 'summary')
       ORDER BY created_at ASC`,
    )
    .all(lastSeen, agent);

  const eventNotifications: Notification[] = eventRows.map((r) => {
    if (r.kind === "status") {
      const data = r.data ? (JSON.parse(r.data) as { from?: string; to?: string }) : {};
      return {
        kind: "status" as const,
        taskId: r.task_id,
        message: `#${r.task_id} status changed to ${data.to ?? "?"} by ${r.actor}`,
        createdAt: r.created_at,
      };
    }
    return {
      kind: "summary" as const,
      taskId: r.task_id,
      message: `#${r.task_id} got a summary from ${r.actor}`,
      createdAt: r.created_at,
    };
  });

  return [...noteNotifications, ...eventNotifications].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function markSeen(db: Database, agent: string, at?: string): void {
  const timestamp = at ?? new Date().toISOString();
  db.query<unknown, [string, string]>(
    `INSERT INTO agent_seen (agent, last_seen_at) VALUES (?, ?)
     ON CONFLICT(agent) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
  ).run(agent, timestamp);
}
