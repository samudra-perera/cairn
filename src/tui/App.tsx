import { useEffect, useMemo, useState } from "react";
import { render, useApp, useInput } from "ink";
import type { Task, TaskStatus } from "../core/tasks";
import { useTasksData } from "./useTasksData";
import { PanelRouter } from "./PanelRouter";

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return statusDiff !== 0 ? statusDiff : a.id - b.id;
  });
}

export function App() {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const data = useTasksData(selectedId);
  const sortedTasks = useMemo(() => sortTasks(data.tasks), [data.tasks]);

  useEffect(() => {
    if (sortedTasks.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const clamped = Math.max(0, Math.min(selectedIndex, sortedTasks.length - 1));
    const id = sortedTasks[clamped]?.id ?? null;
    if (id !== selectedId) setSelectedId(id);
  }, [sortedTasks, selectedIndex]);

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }
    if (sortedTasks.length === 0) return;
    if (input === "j" || key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, sortedTasks.length - 1));
    } else if (input === "k" || key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (key.tab) {
      // reserved for future panel cycling (Needs-You / Agents) — no-op for now
    }
  });

  const selectedTask = sortedTasks.find((t) => t.id === selectedId) ?? null;

  return (
    <PanelRouter
      tasks={sortedTasks}
      selectedId={selectedId}
      selectedTask={selectedTask}
      events={data.events}
      notes={data.notes}
    />
  );
}

export function renderTui(): void {
  render(<App />);
}
