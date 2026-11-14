import { Box, Text } from "ink";
import type { TaskStatus } from "../core/tasks";
import { SelectableRow } from "./SelectableRow";

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
        return (
          <SelectableRow key={status} selected={i === highlighted}>
            {status}
            {status === current && " (current)"}
          </SelectableRow>
        );
      })}
    </Box>
  );
}
