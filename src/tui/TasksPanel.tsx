import { Box, Text } from "ink";
import type { Task, TaskStatus } from "../core/tasks";
import { SelectableRow } from "./SelectableRow";
import { useTerminalSize } from "./useTerminalSize";

export const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  review: "Review",
  done: "Done",
};

const MIN_WIDTH = 42;
const MAX_WIDTH = 80;
const SHARE = 0.45;

/** The task list takes a share of the terminal, within limits; the detail panel gets the rest. */
export function tasksPanelWidth(columns: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(columns * SHARE)));
}

interface Props {
  tasks: Task[];
  selectedId: number | null;
  showAll: boolean;
}

export function TasksPanel({ tasks, selectedId, showAll }: Props) {
  const { columns } = useTerminalSize();
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      paddingX={1}
      width={tasksPanelWidth(columns)}
      flexShrink={0}
    >
      <Text bold>{showAll ? "Tasks - All Branches" : "Tasks - Current Branch"}</Text>
      {tasks.length === 0 && <Text dimColor>No tasks yet.</Text>}
      {STATUS_ORDER.map((status) => {
        const inGroup = tasks.filter((t) => t.status === status);
        if (inGroup.length === 0) return null;
        return (
          <Box key={status} flexDirection="column" marginTop={1}>
            <Text dimColor>{STATUS_LABEL[status]}</Text>
            {inGroup.map((t) => {
              return (
                <SelectableRow key={t.id} selected={t.id === selectedId}>
                  #{t.id} {t.title}
                  {showAll && t.branch ? <Text dimColor> [{t.branch}]</Text> : null}
                  {t.claimedBy ? ` (${t.claimedBy})` : ""}
                </SelectableRow>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
