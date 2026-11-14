import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { describePersonalItem } from "../core/format";
import { SelectableRow } from "./SelectableRow";
import { useCursor } from "./useCursor";
import { usePersonalData } from "./usePersonalData";

/**
 * The personal list. Owns its own keys (j/k, x to complete, u to undo, d then
 * y to delete) while mounted; App only handles `p` and `q` and stays out of
 * the way. Editing a title is CLI-only for now (`cairn me edit`).
 */
export function PersonalView() {
  const { items, complete, undo, remove } = usePersonalData();
  const cursor = useCursor(items.length);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const selected = items[cursor.index];

  useInput((input, key) => {
    if (confirmingDelete) {
      // Only an explicit "y" deletes; any other key cancels.
      if (input === "y" && selected) {
        // The cursor keeps its position, so it lands on the item that slid up
        // into this spot (the next one), or the new last item if this was last.
        remove(selected.id);
      }
      setConfirmingDelete(false);
      return;
    }
    if (items.length === 0) return;
    if (input === "j" || key.downArrow) {
      cursor.next();
    } else if (input === "k" || key.upArrow) {
      cursor.prev();
    } else if ((input === "x" || key.return) && selected) {
      complete(selected.id);
    } else if (input === "u" && selected) {
      undo(selected.id);
    } else if (input === "d" && selected) {
      setConfirmingDelete(true);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} flexGrow={1}>
      <Text bold>Personal</Text>
      {items.length === 0 && (
        <Text dimColor>Nothing here yet. Add one with: cairn me add "..." [--weekly 3]</Text>
      )}
      {items.map((item) => {
        const progress = describePersonalItem(item);
        return (
          <SelectableRow key={item.id} selected={item.id === selected?.id} dim={item.settled}>
            {item.settled ? "[x]" : "[ ]"} {item.title}
            {progress ? <Text dimColor> {progress}</Text> : null}
          </SelectableRow>
        );
      })}
      <Box marginTop={1}>
        {confirmingDelete && selected ? (
          <Text color="red">
            Delete "{selected.title}" and its history? y to confirm, any other key cancels
          </Text>
        ) : (
          <Text dimColor>j/k move · x done · u undo · d delete · p back to tasks · q quit</Text>
        )}
      </Box>
    </Box>
  );
}
