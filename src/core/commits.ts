import type { Database } from "bun:sqlite";
import { z } from "zod";
import { type Event, listEvents, logEvent } from "./events";
import type { BranchCommit } from "./git";

const commitsData = z.object({
  commits: z.array(z.object({ hash: z.string(), subject: z.string() })),
});

/**
 * The commits recorded for a task, oldest first, without repeats. Commits are
 * stored as `commits` events (one per `cairn done`), so this reads them back
 * from a task's events and works for any caller that already has them.
 */
export function commitsFromEvents(events: Event[]): BranchCommit[] {
  const seen = new Set<string>();
  const commits: BranchCommit[] = [];
  for (const event of events) {
    if (event.kind !== "commits") continue;
    const data = commitsData.safeParse(event.data);
    if (!data.success) continue;
    for (const commit of data.data.commits) {
      if (seen.has(commit.hash)) continue;
      seen.add(commit.hash);
      commits.push(commit);
    }
  }
  return commits;
}

/**
 * Records commits on a task as one event, skipping any already recorded (so
 * running `cairn done` twice doesn't list a commit twice). Returns the commits
 * that were new; logs nothing if there are none.
 */
export function recordCommits(
  db: Database,
  taskId: number,
  actor: string,
  commits: BranchCommit[],
): BranchCommit[] {
  const known = new Set(commitsFromEvents(listEvents(db, taskId)).map((c) => c.hash));
  const fresh = commits.filter((c) => !known.has(c.hash));
  if (fresh.length > 0) {
    logEvent(db, { taskId, actor, kind: "commits", data: { commits: fresh } });
  }
  return fresh;
}
