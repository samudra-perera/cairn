import type { Database, SQLQueryBindings } from "bun:sqlite";
import { filterPrivate } from "./notes";
import type { Scope } from "./tasks";

export interface SearchResult {
  kind: "task" | "note";
  taskId: number;
  snippet: string;
}

interface TaskMatchRow {
  task_id: number;
  snippet: string;
}

interface NoteMatchRow {
  task_id: number | null;
  snippet: string;
  private: number;
}

function scopeClause(
  scope: Scope,
  column: "repo" | "t.repo",
  branchColumn: "branch" | "t.branch",
): string[] {
  if (scope === "branch") return [`${column} IS ?`, `${branchColumn} IS ?`];
  if (scope === "repo") return [`${column} IS ?`];
  return [];
}

// FTS5's query syntax treats bare `-`, `"`, `*`, etc. as operators, so a raw
// user query like "feat-auth" throws a syntax error instead of matching.
// Quoting the whole query as one phrase sidesteps FTS5 operator syntax
// entirely, which is the right default for a task search box.
function toPhraseQuery(query: string): string {
  return `"${query.replace(/"/g, '""')}"`;
}

export function searchTasks(
  db: Database,
  query: string,
  filter: { repo: string | null; branch: string | null; scope: Scope },
  opts: { asAgent: boolean },
): SearchResult[] {
  const ftsQuery = toPhraseQuery(query);
  const taskConditions = scopeClause(filter.scope, "repo", "branch");
  const taskParams: SQLQueryBindings[] =
    filter.scope === "all"
      ? []
      : filter.scope === "repo"
        ? [filter.repo]
        : [filter.repo, filter.branch];

  const taskWhere = taskConditions.length > 0 ? `AND ${taskConditions.join(" AND ")}` : "";
  const taskRows = db
    .query<TaskMatchRow, SQLQueryBindings[]>(
      `SELECT tasks.id AS task_id, snippet(tasks_fts, -1, '[', ']', '...', 10) AS snippet
       FROM tasks_fts
       JOIN tasks ON tasks.id = tasks_fts.rowid
       WHERE tasks_fts MATCH ? ${taskWhere}`,
    )
    .all(ftsQuery, ...taskParams);

  const taskResults: SearchResult[] = taskRows.map((row) => ({
    kind: "task",
    taskId: row.task_id,
    snippet: row.snippet,
  }));

  const noteConditions = scopeClause(filter.scope, "t.repo", "t.branch");
  const noteParams: SQLQueryBindings[] =
    filter.scope === "all"
      ? []
      : filter.scope === "repo"
        ? [filter.repo]
        : [filter.repo, filter.branch];

  const noteWhere = noteConditions.length > 0 ? `AND ${noteConditions.join(" AND ")}` : "";
  const noteRows = db
    .query<NoteMatchRow, SQLQueryBindings[]>(
      `SELECT notes.task_id AS task_id,
              snippet(notes_fts, -1, '[', ']', '...', 10) AS snippet,
              notes.private AS private
       FROM notes_fts
       JOIN notes ON notes.id = notes_fts.rowid
       LEFT JOIN tasks t ON t.id = notes.task_id
       WHERE notes_fts MATCH ? ${noteWhere}`,
    )
    .all(ftsQuery, ...noteParams);

  const noteResults: SearchResult[] = filterPrivate(
    noteRows.map((row) => ({
      taskId: row.task_id,
      snippet: row.snippet,
      private: row.private === 1,
    })),
    opts.asAgent,
  )
    .filter((row) => row.taskId !== null)
    .map((row) => ({ kind: "note" as const, taskId: row.taskId as number, snippet: row.snippet }));

  return [...taskResults, ...noteResults];
}
