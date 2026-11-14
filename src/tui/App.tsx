import { useEffect, useMemo, useState } from "react";
import { render, useApp, useInput } from "ink";
import type { Task } from "../core/tasks";
import { useTasksData } from "./useTasksData";
import { PanelRouter } from "./PanelRouter";
import { STATUS_ORDER } from "./TasksPanel";
import { PersonalView } from "./PersonalView";
import { FullScreen } from "./FullScreen";
import { enterAltScreen } from "./altScreen";
import { useCursor } from "./useCursor";

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return statusDiff !== 0 ? statusDiff : a.id - b.id;
  });
}

export function App() {
  const { exit } = useApp();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const picker = useCursor(STATUS_ORDER.length);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"tasks" | "personal">("tasks");

  const data = useTasksData(selectedId, showAll);
  const sortedTasks = useMemo(() => sortTasks(data.tasks), [data.tasks]);
  const list = useCursor(sortedTasks.length);

  useEffect(() => {
    if (sortedTasks.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const id = sortedTasks[list.index]?.id ?? null;
    if (id !== selectedId) setSelectedId(id);
  }, [sortedTasks, list.index]);

  useInput((input, key) => {
    //We have the pickerOpen as the owner of q and j/k while open
    if (pickerOpen) {
      if (key.escape) {
        setPickerOpen(false);
        return;
      }
      if (key.return) {
        const chosen = STATUS_ORDER[picker.index];
        if (selectedTask && chosen && chosen !== selectedTask.status) {
          data.changeStatus(selectedTask.id, chosen);
          // The following code is so the cursor follows where the changes move to
          const moved = sortTasks(
            sortedTasks.map((t) => (t.id === selectedTask.id ? { ...t, status: chosen } : t)),
          );
          list.set(moved.findIndex((t) => t.id === selectedTask.id));
        }
        setPickerOpen(false);
        return;
      }
      if (input === "j" || key.downArrow) picker.next();
      if (input === "k" || key.upArrow) picker.prev();
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (input === "p") {
      setView((v) => (v === "tasks" ? "personal" : "tasks"));
      return;
    }
    // PersonalView handles every other key while it's showing.
    if (view === "personal") return;
    if (input === "a") {
      setShowAll((v) => !v);
      return;
    }
    if (sortedTasks.length === 0) return;

    if (input === "u" && selectedTask) {
      picker.set(STATUS_ORDER.indexOf(selectedTask.status));
      setPickerOpen(true);
      return;
    }
    if (input === "j" || key.downArrow) {
      list.next();
    } else if (input === "k" || key.upArrow) {
      list.prev();
    } else if (key.tab) {
      // reserved for future panel cycling (Needs-You / Agents) — no-op for now
    }
  });

  const selectedTask = sortedTasks.find((t) => t.id === selectedId) ?? null;

  if (view === "personal") {
    return (
      <FullScreen>
        <PersonalView />
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <PanelRouter
        tasks={sortedTasks}
        selectedId={selectedId}
        selectedTask={selectedTask}
        events={data.events}
        notes={data.notes}
        pickerOpen={pickerOpen}
        pickerIndex={picker.index}
        showAll={showAll}
      />
    </FullScreen>
  );
}

export function renderTui(): void {
  const restoreScreen = enterAltScreen();
  const instance = render(<App />);
  // q and Ctrl+C both end up here; signals and crashes are handled in enterAltScreen.
  void instance.waitUntilExit().finally(restoreScreen);
}
