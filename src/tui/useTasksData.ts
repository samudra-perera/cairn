import { useEffect, useRef, useState } from "react";
import type { Database } from "bun:sqlite";
import { getDataVersion, openDb } from "../core/db";
import { getAgent, getRepoContext } from "../core/context";
import { type Task, listTasks } from "../core/tasks";
import { type Event, listEvents } from "../core/events";
import { type Note, listNotesForTask } from "../core/notes";

export interface TasksData {
  tasks: Task[];
  events: Event[];
  notes: Note[];
  loading: boolean;
}

let sharedDb: Database | null = null;
function getSharedDb(): Database {
  if (!sharedDb) sharedDb = openDb();
  return sharedDb;
}

/**
 * The only hook in the TUI that imports core/ query functions (openDb,
 * getDataVersion, listTasks, listEvents, listNotesForTask) — everything
 * else in tui/ imports core/ types only, keeping the core -> tui import
 * direction at zero.
 */
export function useTasksData(selectedId: number | null): TasksData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const lastVersionRef = useRef<number | null>(null);

  useEffect(() => {
    const db = getSharedDb();
    const repoContext = getRepoContext();

    function refreshTasks() {
      setTasks(
        listTasks(db, { repo: repoContext.repoId, branch: repoContext.branch, scope: "branch" }),
      );
      setLoading(false);
    }

    refreshTasks();
    const interval = setInterval(() => {
      const version = getDataVersion(db);
      if (version !== lastVersionRef.current) {
        lastVersionRef.current = version;
        refreshTasks();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const db = getSharedDb();
    const isAgent = getAgent() !== null;

    if (selectedId === null) {
      setEvents([]);
      setNotes([]);
      return;
    }

    setEvents(listEvents(db, selectedId));
    setNotes(listNotesForTask(db, selectedId, { asAgent: isAgent }));
    // Re-run on every tasks refresh too, so the detail panel picks up new
    // notes/events from the same 1s data_version poll, not just selection changes.
  }, [selectedId, tasks]);

  return { tasks, events, notes, loading };
}
