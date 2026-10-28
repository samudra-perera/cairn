import type { Database, SQLQueryBindings } from "bun:sqlite";
import { logEvent } from "./events";
export type TaskStatus = "todo" | "doing" | "review" | "done";
export type Scope = "branch" | "repo" | "all";

export class TaskNotFoundError extends Error {}
export class InvalidTransitionError extends Error {}

export interface Task {
  id: number;
  title: string;
  body: string | null;
  status: TaskStatus;
  owner: string;
  claimedBy: string | null;
  repo: string | null;
  branch: string | null;
  featureId: number | null;
  summary: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  doneAt: string | null;
}

interface TaskRow {
  id: number;
  title: string;
  body: string | null;
  status: TaskStatus;
  owner: string;
  claimed_by: string | null;
  repo: string | null;
  branch: string | null;
  feature_id: number | null;
  summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  done_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    owner: row.owner,
    claimedBy: row.claimed_by,
    repo: row.repo,
    branch: row.branch,
    featureId: row.feature_id,
    summary: row.summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    doneAt: row.done_at,
  };
}

export function createTask(
  db: Database,
  input: {
    title: string;
    body?: string | null;
    owner?: string;
    repo: string | null;
    branch: string | null;
    createdBy: string;
    refs?: number[];
  },
): Task {
  const now = new Date().toISOString();
  const owner = input.owner ?? "me";

  const row = db
    .query<
      TaskRow,
      [
        string,
        string | null,
        string,
        string | null,
        string | null,
        string,
        string,
        string,
      ]
    >(
      `INSERT INTO tasks (title, body, owner, repo, branch, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.title,
      input.body ?? null,
      owner,
      input.repo,
      input.branch,
      input.createdBy,
      now,
      now,
    );

  if (!row) throw new Error("Failed to insert task");
  const task = rowToTask(row);

  for (const toId of input.refs ?? []) {
    db.query<unknown, [number, number]>(
      `INSERT INTO refs (from_id, to_id) VALUES (?, ?)`,
    ).run(task.id, toId);
  }

  logEvent(db, {
    taskId: task.id,
    actor: input.createdBy,
    kind: "created",
    data: { title: task.title },
  });
  return task;
}

export function listTasks(
  db: Database,
  filter: {
    repo: string | null;
    branch: string | null;
    scope: Scope;
    owner?: string;
    status?: TaskStatus;
  },
): Task[] {
  const conditions: string[] = [];
  const params: SQLQueryBindings[] = [];

  if (filter.scope === "branch") {
    conditions.push("repo IS ?", "branch IS ?");
    params.push(filter.repo, filter.branch);
  } else if (filter.scope === "repo") {
    conditions.push("repo IS ?");
    params.push(filter.repo);
  }
  // scope === 'all': no repo/branch restriction

  if (filter.owner) {
    conditions.push("owner = ?");
    params.push(filter.owner);
  }
  if (filter.status) {
    conditions.push("status = ?");
    params.push(filter.status);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .query<
      TaskRow,
      SQLQueryBindings[]
    >(`SELECT * FROM tasks ${where} ORDER BY created_at ASC`)
    .all(...params);

  return rows.map(rowToTask);
}

export function getTask(db: Database, id: number): Task {
  const row = db
    .query<TaskRow, [number]>(`SELECT * FROM tasks WHERE id = ?`)
    .get(id);
  if (!row) throw new TaskNotFoundError(`task ${id} not found`);
  return rowToTask(row);
}

export function claimTask(
  db: Database,
  id: number,
  agent: string,
):
  | { ok: true; task: Task }
  | { ok: false; reason: "not_found" | "already_claimed" } {
  const now = new Date().toISOString();
  const row = db
    .query<TaskRow, [string, string, number]>(
      `UPDATE tasks
       SET claimed_by = ?,
           status = CASE WHEN status = 'todo' THEN 'doing' ELSE status END,
           updated_at = ?
       WHERE id = ? AND claimed_by IS NULL
       RETURNING *`,
    )
    .get(agent, now, id);

  if (row) {
    logEvent(db, {
      taskId: id,
      actor: agent,
      kind: "claimed",
      data: { claimedBy: agent },
    });
    return { ok: true, task: rowToTask(row) };
  }

  const exists = db
    .query<{ id: number }, [number]>(`SELECT id FROM tasks WHERE id = ?`)
    .get(id);
  return { ok: false, reason: exists ? "already_claimed" : "not_found" };
}

export function assignTask(
  db: Database,
  id: number,
  assignee: string,
  actor: string,
): { ok: true; task: Task } | { ok: false; reason: "not_found" } {
  const existing = db
    .query<TaskRow, [number]>(`SELECT * FROM tasks WHERE id = ?`)
    .get(id);
  if (!existing) return { ok: false, reason: "not_found" };

  //There is the possibilty in the future that there could be a race condition
  //where different process accessing the update may have stale infomation
  const now = new Date().toISOString();
  const row = db
    .query<
      TaskRow,
      [string, string, number]
    >(`UPDATE tasks SET claimed_by = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .get(assignee, now, id);

  if (!row) return { ok: false, reason: "not_found" };

  logEvent(db, {
    taskId: id,
    actor,
    kind: "assigned",
    data: { assignedTo: assignee, previous: existing.claimed_by },
  });
  return { ok: true, task: rowToTask(row) };
}

export function setStatus(
  db: Database,
  id: number,
  status: TaskStatus,
  actor: string,
  isAgent: boolean,
): Task {
  if (isAgent && status === "done") {
    throw new InvalidTransitionError(
      "agents cannot set status to 'done' directly; use completeTask",
    );
  }

  const existing = getTask(db, id);
  const now = new Date().toISOString();
  const doneAt = status === "done" ? now : existing.doneAt;

  const row = db
    .query<
      TaskRow,
      [TaskStatus, string | null, string, number]
    >(`UPDATE tasks SET status = ?, done_at = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .get(status, doneAt, now, id);

  if (!row) throw new TaskNotFoundError(`task ${id} not found`);
  logEvent(db, {
    taskId: id,
    actor,
    kind: "status",
    data: { from: existing.status, to: status },
  });
  return rowToTask(row);
}

export function completeTask(
  db: Database,
  id: number,
  actor: string,
  isAgent: boolean,
  summary: string,
): Task {
  const existing = getTask(db, id);
  const now = new Date().toISOString();
  const newStatus: TaskStatus = isAgent ? "review" : "done";
  const doneAt = !isAgent ? now : existing.doneAt;

  const row = db
    .query<
      TaskRow,
      [TaskStatus, string, string | null, string, number]
    >(`UPDATE tasks SET status = ?, summary = ?, done_at = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .get(newStatus, summary, doneAt, now, id);

  if (!row) throw new TaskNotFoundError(`task ${id} not found`);

  logEvent(db, { taskId: id, actor, kind: "summary", data: { summary } });
  logEvent(db, {
    taskId: id,
    actor,
    kind: "status",
    data: { from: existing.status, to: newStatus },
  });
  return rowToTask(row);
}

export function updateTaskContent(
  db: Database,
  id: number,
  patch: { title?: string; body?: string | null },
  actor: string,
): Task {
  const existing = getTask(db, id);
  const title = patch.title ?? existing.title;
  const body = patch.body !== undefined ? patch.body : existing.body;
  const now = new Date().toISOString();

  const row = db
    .query<
      TaskRow,
      [string, string | null, string, number]
    >(`UPDATE tasks SET title = ?, body = ?, updated_at = ? WHERE id = ? RETURNING *`)
    .get(title, body, now, id);

  if (!row) throw new TaskNotFoundError(`task ${id} not found`);
  logEvent(db, { taskId: id, actor, kind: "edited", data: {} });
  return rowToTask(row);
}
