import { Box, Text } from "ink";
import type { Task, TaskStatus } from "../core/tasks";

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  doing: "Doing",
  review: "Review",
  done: "Done",
};

interface Props {
  tasks: Task[];
  selectedId: number | null;
}

export function TasksPanel({ tasks, selectedId }: Props) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} width={42}>
      <Text bold>Tasks</Text>
      {tasks.length === 0 && <Text dimColor>No tasks yet.</Text>}
      {STATUS_ORDER.map((status) => {
        const inGroup = tasks.filter((t) => t.status === status);
        if (inGroup.length === 0) return null;
        return (
          <Box key={status} flexDirection="column" marginTop={1}>
            <Text dimColor>{STATUS_LABEL[status]}</Text>
            {inGroup.map((t) => {
              const isSelected = t.id === selectedId;
              return (
                <Text key={t.id} color={isSelected ? "cyan" : undefined}>
                  {isSelected ? "> " : "  "}#{t.id} {t.title}
                  {t.claimedBy ? ` (${t.claimedBy})` : ""}
                </Text>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
