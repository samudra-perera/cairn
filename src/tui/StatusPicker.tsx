import { Box, Text } from "ink";
import type { TaskStatus } from "../core/tasks";

interface Props {
  statuses: TaskStatus[];
  highlighted: number;
  current: TaskStatus;
}
export function StatusPicker({ statuses, highlighted, current }: Props) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>Move to...</Text>
      {statuses.map((status, i) => {
        const isHighlighted = i === highlighted;
        return (
          <Text key={status} color={isHighlighted ? "cyan" : undefined}>
            {isHighlighted ? "> " : "  "}
            {status}
            {status === current && " (current)"}
          </Text>
        );
      })}
    </Box>
  );
}
