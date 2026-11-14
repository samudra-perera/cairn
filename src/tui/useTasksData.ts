import { useEffect, useState } from "react";
import { callerIdentity, getAgent, getRepoContext } from "../core/context";
import { type Task, type TaskStatus, listTasks, setStatus } from "../core/tasks";
import { type Event, listEvents } from "../core/events";
import { type Note, listNotesForTask } from "../core/notes";
import { getSharedDb } from "./sharedDb";
import { useDataPolling } from "./useDataPolling";

export interface TasksData {
  tasks: Task[];
  events: Event[];
  notes: Note[];
  loading: boolean;
  changeStatus: (id: number, status: TaskStatus) => void;
}

/**
 * The task data hook. Data hooks (this one and usePersonalData) are the only
 * TUI code that imports core/ query functions — components import core/ types
 * only, keeping the core -> tui import direction at zero.
 */
export function useTasksData(selectedId: number | null, showAll: boolean): TasksData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  function refreshTasks() {
    const db = getSharedDb();
    const repoContext = getRepoContext();
    setTasks(
      listTasks(db, {
        repo: repoContext.repoId,
        branch: repoContext.branch,
        scope: showAll ? "all" : "branch",
      }),
    );
    setLoading(false);
  }

  function changeStatus(id: number, status: TaskStatus) {
    setStatus(getSharedDb(), id, status, callerIdentity(), false);
    refreshTasks();
  }

  useDataPolling(refreshTasks, [showAll]);

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

  return { tasks, events, notes, loading, changeStatus };
}
