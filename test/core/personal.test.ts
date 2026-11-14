import { beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { makeTestDb } from "../helpers/testDb";
import {
  addDays,
  addPersonalItem,
  completePersonalItem,
  computeStreak,
  deletePersonalItem,
  editPersonalItem,
  listPersonalItems,
  toLocalDate,
  undoPersonalItem,
  weekStart,
} from "../../src/core/personal";

// 2026-11-04 is a Wednesday; its week runs Mon 2026-11-02 to Sun 2026-11-08.
const WED = "2026-11-04";
const MON = "2026-11-02";

describe("core/personal dates", () => {
  test("weekStart returns the Monday of the week, Sunday included", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(weekStart("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(weekStart("2026-11-09")).toBe("2026-11-09"); // next Monday
  });

  test("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-11-04", -7)).toBe("2026-10-28");
  });

  test("toLocalDate formats the local calendar day with zero padding", () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("core/personal computeStreak", () => {
  const week = (monday: string, n: number) =>
    Array.from({ length: n }, (_, i) => addDays(monday, i));

  test("no completions is a streak of 0", () => {
    expect(computeStreak([], 3, WED)).toBe(0);
  });

  test("counts consecutive past weeks that hit the target", () => {
    const days = [...week("2026-10-19", 3), ...week("2026-10-26", 3)];
    expect(computeStreak(days, 3, WED)).toBe(2);
  });

  test("the current week in progress neither adds to nor breaks the streak", () => {
    const days = [...week("2026-10-26", 3), ...week(MON, 1)];
    expect(computeStreak(days, 3, WED)).toBe(1);
  });

  test("the current week counts once it hits the target", () => {
    const days = [...week("2026-10-26", 3), ...week(MON, 3)];
    expect(computeStreak(days, 3, WED)).toBe(2);
  });

  test("a missed week resets the streak", () => {
    const days = [...week("2026-10-12", 3), ...week("2026-10-26", 3)];
    expect(computeStreak(days, 3, WED)).toBe(1);
  });

  test("a week one short of the target does not count", () => {
    expect(computeStreak(week("2026-10-26", 2), 3, WED)).toBe(0);
  });
});

describe("core/personal items", () => {
  let db: Database;
  beforeEach(() => {
    db = makeTestDb();
  });

  test("addPersonalItem stores a one-off and a recurring item", () => {
    const oneOff = addPersonalItem(db, { title: "Apply to Acme" });
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    expect(oneOff.targetPerWeek).toBeNull();
    expect(gym.targetPerWeek).toBe(3);
  });

  test("a target outside 1-7 is rejected by the schema", () => {
    expect(() => addPersonalItem(db, { title: "x", targetPerWeek: 0 })).toThrow();
    expect(() => addPersonalItem(db, { title: "x", targetPerWeek: 8 })).toThrow();
  });

  test("a one-off done today is settled, shown, and sorted after open items", () => {
    const first = addPersonalItem(db, { title: "first" });
    const second = addPersonalItem(db, { title: "second" });
    completePersonalItem(db, first.id, WED);

    const list = listPersonalItems(db, WED);
    expect(list.map((i) => i.id)).toEqual([second.id, first.id]);
    expect(list[1]).toMatchObject({ doneToday: true, settled: true });
  });

  test("a one-off finished on an earlier day drops off the list", () => {
    const item = addPersonalItem(db, { title: "old" });
    completePersonalItem(db, item.id, MON);
    expect(listPersonalItems(db, WED)).toEqual([]);
  });

  test("a recurring item stays visible, marked done today, until the target is hit", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    completePersonalItem(db, gym.id, MON);
    completePersonalItem(db, gym.id, WED);

    const [view] = listPersonalItems(db, WED);
    expect(view).toMatchObject({ doneToday: true, doneThisWeek: 2, settled: false });
  });

  test("hitting the target settles it for the week and it returns next Monday", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    for (const day of [MON, "2026-11-03", WED]) completePersonalItem(db, gym.id, day);

    expect(listPersonalItems(db, WED)[0]).toMatchObject({ settled: true, doneThisWeek: 3 });
    expect(listPersonalItems(db, "2026-11-08")[0]?.settled).toBe(true);

    const nextMonday = listPersonalItems(db, "2026-11-09")[0];
    expect(nextMonday).toMatchObject({ settled: false, doneThisWeek: 0, doneToday: false });
    expect(nextMonday?.streak).toBe(1);
  });

  test("a week's completions don't leak into the next week", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    completePersonalItem(db, gym.id, "2026-11-08"); // Sunday
    completePersonalItem(db, gym.id, "2026-11-09"); // Monday
    expect(listPersonalItems(db, "2026-11-09")[0]?.doneThisWeek).toBe(1);
  });

  test("completing twice on the same day is rejected", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    expect(completePersonalItem(db, gym.id, WED)).toEqual({ ok: true });
    expect(completePersonalItem(db, gym.id, WED)).toEqual({ ok: false, reason: "already_done" });
  });

  test("a finished one-off can't be completed again on a later day", () => {
    const item = addPersonalItem(db, { title: "once" });
    completePersonalItem(db, item.id, MON);
    expect(completePersonalItem(db, item.id, WED)).toEqual({ ok: false, reason: "already_done" });
  });

  test("completing or undoing an unknown id is not_found", () => {
    expect(completePersonalItem(db, 999, WED)).toEqual({ ok: false, reason: "not_found" });
    expect(undoPersonalItem(db, 999, WED)).toEqual({ ok: false, reason: "not_found" });
  });

  test("undo removes today's completion only", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    completePersonalItem(db, gym.id, MON);
    completePersonalItem(db, gym.id, WED);

    expect(undoPersonalItem(db, gym.id, WED)).toEqual({ ok: true });
    expect(listPersonalItems(db, WED)[0]).toMatchObject({ doneToday: false, doneThisWeek: 1 });
    expect(undoPersonalItem(db, gym.id, WED)).toEqual({ ok: false, reason: "not_done_today" });
  });

  test("undo reopens a one-off finished today", () => {
    const item = addPersonalItem(db, { title: "once" });
    completePersonalItem(db, item.id, WED);
    undoPersonalItem(db, item.id, WED);
    expect(listPersonalItems(db, WED)[0]?.settled).toBe(false);
  });

  test("the personal list never touches the tasks table", () => {
    addPersonalItem(db, { title: "private" });
    const n = db.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM tasks`).get();
    expect(n?.n).toBe(0);
  });

  test("editPersonalItem changes the title and leaves the target alone", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    const result = editPersonalItem(db, gym.id, { title: "Lift" });
    expect(result).toMatchObject({ ok: true, item: { title: "Lift", targetPerWeek: 3 } });
  });

  test("editPersonalItem can change the target, or null it to make a one-off", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    expect(editPersonalItem(db, gym.id, { targetPerWeek: 4 })).toMatchObject({
      item: { title: "Gym", targetPerWeek: 4 },
    });
    expect(editPersonalItem(db, gym.id, { targetPerWeek: null })).toMatchObject({
      item: { targetPerWeek: null },
    });
  });

  test("editing keeps the completion history", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    completePersonalItem(db, gym.id, WED);
    editPersonalItem(db, gym.id, { title: "Lift", targetPerWeek: 2 });
    expect(listPersonalItems(db, WED)[0]).toMatchObject({ doneToday: true, doneThisWeek: 1 });
  });

  test("editing an unknown id is not_found", () => {
    expect(editPersonalItem(db, 999, { title: "x" })).toEqual({ ok: false, reason: "not_found" });
  });

  test("editing to an invalid target is rejected by the schema", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    expect(() => editPersonalItem(db, gym.id, { targetPerWeek: 9 })).toThrow();
  });

  test("deletePersonalItem removes the item and its completions, and only that item", () => {
    const gym = addPersonalItem(db, { title: "Gym", targetPerWeek: 3 });
    const other = addPersonalItem(db, { title: "Other" });
    completePersonalItem(db, gym.id, WED);
    completePersonalItem(db, other.id, WED);

    expect(deletePersonalItem(db, gym.id)).toEqual({ ok: true });
    expect(listPersonalItems(db, WED).map((i) => i.id)).toEqual([other.id]);
    const left = db
      .query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM personal_completions`)
      .get();
    expect(left?.n).toBe(1);
  });

  test("deleting an unknown id is not_found", () => {
    expect(deletePersonalItem(db, 999)).toEqual({ ok: false, reason: "not_found" });
  });
});
