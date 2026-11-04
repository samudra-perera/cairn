import type { Database } from "bun:sqlite";

export interface PersonalItem {
  id: number;
  title: string;
  /** null for a one-off item; otherwise the wanted completions per Mon-Sun week. */
  targetPerWeek: number | null;
  createdAt: string;
}

export interface PersonalItemView extends PersonalItem {
  doneToday: boolean;
  /** Distinct days completed in the current week (always 0 for one-off items). */
  doneThisWeek: number;
  /** Consecutive weeks that hit the target (always 0 for one-off items). */
  streak: number;
  /**
   * Nothing left to do for now: a one-off done today, or a recurring item
   * that hit its target this week. Settled items sort to the bottom.
   */
  settled: boolean;
}

interface ItemRow {
  id: number;
  title: string;
  target_per_week: number | null;
  created_at: string;
}

function rowToItem(row: ItemRow): PersonalItem {
  return {
    id: row.id,
    title: row.title,
    targetPerWeek: row.target_per_week,
    createdAt: row.created_at,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Date as its local calendar day, "YYYY-MM-DD". */
export function toLocalDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Day arithmetic goes through UTC so a DST change can't shift the result.
function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return formatDay(parseDay(day) + days * DAY_MS);
}

/** The Monday of the week containing `day` (weeks run Monday to Sunday). */
export function weekStart(day: string): string {
  const sinceMonday = (new Date(parseDay(day)).getUTCDay() + 6) % 7;
  return addDays(day, -sinceMonday);
}

/**
 * Consecutive weeks that reached `target`. The current week counts once it
 * has reached the target; while it's still in progress it neither adds to the
 * streak nor breaks it.
 */
export function computeStreak(completedDays: string[], target: number, today: string): number {
  const perWeek = new Map<string, number>();
  for (const day of completedDays) {
    const week = weekStart(day);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  const hit = (week: string) => (perWeek.get(week) ?? 0) >= target;

  let week = weekStart(today);
  if (!hit(week)) week = addDays(week, -7);
  let streak = 0;
  while (hit(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function addPersonalItem(
  db: Database,
  input: { title: string; targetPerWeek?: number | null },
): PersonalItem {
  const row = db
    .query<ItemRow, [string, number | null, string]>(
      `INSERT INTO personal_items (title, target_per_week, created_at)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(input.title, input.targetPerWeek ?? null, new Date().toISOString());
  if (!row) throw new Error("Failed to insert personal item");
  return rowToItem(row);
}

/**
 * The personal list as of `today`: unsettled items first, then settled ones,
 * each group in creation order. A one-off finished before today is dropped so
 * the list doesn't grow forever.
 */
export function listPersonalItems(db: Database, today: string = toLocalDate()): PersonalItemView[] {
  const items = db
    .query<ItemRow, []>(`SELECT * FROM personal_items ORDER BY id ASC`)
    .all()
    .map(rowToItem);
  const completions = db
    .query<{ item_id: number; completed_on: string }, []>(
      `SELECT item_id, completed_on FROM personal_completions ORDER BY completed_on ASC`,
    )
    .all();

  const daysByItem = new Map<number, string[]>();
  for (const c of completions) {
    const days = daysByItem.get(c.item_id) ?? [];
    days.push(c.completed_on);
    daysByItem.set(c.item_id, days);
  }

  const thisWeek = weekStart(today);
  const views: PersonalItemView[] = [];
  for (const item of items) {
    const days = daysByItem.get(item.id) ?? [];
    const doneToday = days.includes(today);

    if (item.targetPerWeek === null) {
      if (days.length > 0 && !doneToday) continue;
      views.push({
        ...item,
        doneToday,
        doneThisWeek: 0,
        streak: 0,
        settled: days.length > 0,
      });
      continue;
    }

    const doneThisWeek = days.filter((d) => weekStart(d) === thisWeek).length;
    views.push({
      ...item,
      doneToday,
      doneThisWeek,
      streak: computeStreak(days, item.targetPerWeek, today),
      settled: doneThisWeek >= item.targetPerWeek,
    });
  }

  return views.sort((a, b) => Number(a.settled) - Number(b.settled) || a.id - b.id);
}

export function getPersonalItem(db: Database, id: number): PersonalItem | null {
  const row = db.query<ItemRow, [number]>(`SELECT * FROM personal_items WHERE id = ?`).get(id);
  return row ? rowToItem(row) : null;
}

export type CompleteResult = { ok: true } | { ok: false; reason: "not_found" | "already_done" };

/** Marks the item done for `today`. One completion per item per day. */
export function completePersonalItem(
  db: Database,
  id: number,
  today: string = toLocalDate(),
): CompleteResult {
  const item = db.query<ItemRow, [number]>(`SELECT * FROM personal_items WHERE id = ?`).get(id);
  if (!item) return { ok: false, reason: "not_found" };

  // A one-off that's already finished on an earlier day stays finished.
  if (item.target_per_week === null) {
    const any = db
      .query<{ n: number }, [number]>(
        `SELECT COUNT(*) AS n FROM personal_completions WHERE item_id = ?`,
      )
      .get(id);
    if ((any?.n ?? 0) > 0) return { ok: false, reason: "already_done" };
  }

  const inserted = db
    .query<unknown, [number, string, string]>(
      `INSERT OR IGNORE INTO personal_completions (item_id, completed_on, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(id, today, new Date().toISOString());
  return inserted.changes === 0 ? { ok: false, reason: "already_done" } : { ok: true };
}

export type UndoResult = { ok: true } | { ok: false; reason: "not_found" | "not_done_today" };

/** Removes today's completion, e.g. after marking the wrong item. */
export function undoPersonalItem(
  db: Database,
  id: number,
  today: string = toLocalDate(),
): UndoResult {
  const item = db.query(`SELECT 1 FROM personal_items WHERE id = ?`).get(id);
  if (!item) return { ok: false, reason: "not_found" };

  const removed = db
    .query<unknown, [number, string]>(
      `DELETE FROM personal_completions WHERE item_id = ? AND completed_on = ?`,
    )
    .run(id, today);
  return removed.changes === 0 ? { ok: false, reason: "not_done_today" } : { ok: true };
}

export type EditResult = { ok: true; item: PersonalItem } | { ok: false; reason: "not_found" };

/**
 * Changes an item's title and/or its weekly target (null makes it a one-off).
 * Omitted fields are left alone. Completion history is kept, so switching an
 * item between one-off and recurring doesn't lose past days.
 */
export function editPersonalItem(
  db: Database,
  id: number,
  changes: { title?: string; targetPerWeek?: number | null },
): EditResult {
  const existing = db.query<ItemRow, [number]>(`SELECT * FROM personal_items WHERE id = ?`).get(id);
  if (!existing) return { ok: false, reason: "not_found" };

  const title = changes.title ?? existing.title;
  const target =
    changes.targetPerWeek === undefined ? existing.target_per_week : changes.targetPerWeek;

  const row = db
    .query<ItemRow, [string, number | null, number]>(
      `UPDATE personal_items SET title = ?, target_per_week = ? WHERE id = ? RETURNING *`,
    )
    .get(title, target, id);
  if (!row) return { ok: false, reason: "not_found" };
  return { ok: true, item: rowToItem(row) };
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" };

/** Permanently removes the item and its completion history. */
export function deletePersonalItem(db: Database, id: number): DeleteResult {
  db.run("BEGIN;");
  try {
    db.query<unknown, [number]>(`DELETE FROM personal_completions WHERE item_id = ?`).run(id);
    const removed = db.query<unknown, [number]>(`DELETE FROM personal_items WHERE id = ?`).run(id);
    db.run("COMMIT;");
    return removed.changes === 0 ? { ok: false, reason: "not_found" } : { ok: true };
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
}
