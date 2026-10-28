import type { Database } from "bun:sqlite";

export type EventKind =
  "created" | "claimed" | "status" | "noted" | "summary" | "assigned" | string;

export interface Event {
  id: number;
  taskId: number | null;
  actor: string;
  kind: EventKind;
  data: unknown;
  createdAt: string;
}

interface EventRow {
  id: number;
  task_id: number | null;
  actor: string;
  kind: string;
  data: string | null;
  created_at: string;
}

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    taskId: row.task_id,
    actor: row.actor,
    kind: row.kind,
    data: row.data ? JSON.parse(row.data) : null,
    createdAt: row.created_at,
  };
}

export function logEvent(
  db: Database,
  input: {
    taskId: number | null;
    actor: string;
    kind: EventKind;
    data?: unknown;
  },
): Event {
  const createdAt = new Date().toISOString();
  const dataJson = input.data !== undefined ? JSON.stringify(input.data) : null;

  const row = db
    .query<EventRow, [number | null, string, string, string | null, string]>(
      `INSERT INTO events (task_id, actor, kind, data, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(input.taskId, input.actor, input.kind, dataJson, createdAt);

  if (!row) throw new Error("Failed to insert event");
  return rowToEvent(row);
}

export function listEvents(db: Database, taskId: number): Event[] {
  const rows = db
    .query<EventRow, [number]>(
      `SELECT * FROM events WHERE task_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .all(taskId);
  return rows.map(rowToEvent);
}
