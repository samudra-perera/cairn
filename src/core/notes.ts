import type { Database, SQLQueryBindings } from "bun:sqlite";
import { logEvent } from "./events";
import type { Scope } from "./tasks";

export class PrivateNoteForbiddenError extends Error {}

export interface Note {
  id: number;
  taskId: number | null;
  repo: string | null;
  branch: string | null;
  author: string;
  body: string;
  private: boolean;
  createdAt: string;
}

interface NoteRow {
  id: number;
  task_id: number | null;
  repo: string | null;
  branch: string | null;
  author: string;
  body: string;
  private: number;
  created_at: string;
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    taskId: row.task_id,
    repo: row.repo,
    branch: row.branch,
    author: row.author,
    body: row.body,
    private: row.private === 1,
    createdAt: row.created_at,
  };
}

/**
 * The single reusable privacy gate: strips private notes whenever the
 * reader is an agent. Every read path (notes.ts, search.ts, notify.ts)
 * must funnel through this rather than reimplementing the filter.
 */
export function filterPrivate<T extends { private: boolean }>(notes: T[], asAgent: boolean): T[] {
  return asAgent ? notes.filter((n) => !n.private) : notes;
}

export function addNote(
  db: Database,
  input: {
    taskId?: number | null;
    repo: string | null;
    branch: string | null;
    author: string;
    body: string;
    private?: boolean;
    isAgent: boolean;
  },
): Note {
  if (input.isAgent && input.private) {
    throw new PrivateNoteForbiddenError("agents cannot create private notes");
  }

  const now = new Date().toISOString();
  const taskId = input.taskId ?? null;
  const isPrivate = input.private ?? false;

  const row = db
    .query<NoteRow, [number | null, string | null, string | null, string, string, number, string]>(
      `INSERT INTO notes (task_id, repo, branch, author, body, private, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(taskId, input.repo, input.branch, input.author, input.body, isPrivate ? 1 : 0, now);

  if (!row) throw new Error("Failed to insert note");
  const note = rowToNote(row);

  if (note.taskId !== null) {
    logEvent(db, {
      taskId: note.taskId,
      actor: note.author,
      kind: "noted",
      data: { private: note.private },
    });
  }

  return note;
}

export function listNotesForTask(db: Database, taskId: number, opts: { asAgent: boolean }): Note[] {
  const rows = db
    .query<NoteRow, [number]>(`SELECT * FROM notes WHERE task_id = ? ORDER BY created_at ASC`)
    .all(taskId);
  return filterPrivate(rows.map(rowToNote), opts.asAgent);
}

export function listStandaloneNotes(
  db: Database,
  filter: { repo: string | null; branch: string | null; scope: Scope },
  opts: { asAgent: boolean },
): Note[] {
  const conditions: string[] = ["task_id IS NULL"];
  const params: SQLQueryBindings[] = [];

  if (filter.scope === "branch") {
    conditions.push("repo IS ?", "branch IS ?");
    params.push(filter.repo, filter.branch);
  } else if (filter.scope === "repo") {
    conditions.push("repo IS ?");
    params.push(filter.repo);
  }
  // scope === 'all': no repo/branch restriction

  const rows = db
    .query<NoteRow, SQLQueryBindings[]>(
      `SELECT * FROM notes WHERE ${conditions.join(" AND ")} ORDER BY created_at ASC`,
    )
    .all(...params);

  return filterPrivate(rows.map(rowToNote), opts.asAgent);
}
