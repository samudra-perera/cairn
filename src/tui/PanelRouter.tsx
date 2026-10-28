import { Box } from "ink";
import type { Task } from "../core/tasks";
import type { Event } from "../core/events";
import type { Note } from "../core/notes";
import { TasksPanel } from "./TasksPanel";
import { DetailPanel } from "./DetailPanel";

interface Props {
  tasks: Task[];
  selectedId: number | null;
  selectedTask: Task | null;
  events: Event[];
  notes: Note[];
}

/**
 * Layout seam for the rest of v0's TUI: the top slot is reserved for the
 * future "Needs you" / "Agents" panels, left empty rather than built now.
 */
export function PanelRouter({ tasks, selectedId, selectedTask, events, notes }: Props) {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <TasksPanel tasks={tasks} selectedId={selectedId} />
        <DetailPanel task={selectedTask} events={events} notes={notes} />
      </Box>
    </Box>
  );
}
