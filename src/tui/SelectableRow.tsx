import type { ReactNode } from "react";
import { Text } from "ink";

interface Props {
  selected: boolean;
  /** Dim the whole row, e.g. for finished items. */
  dim?: boolean;
  children: ReactNode;
}

/** One line of a list: a cyan "> " marker on the row the cursor is on. */
export function SelectableRow({ selected, dim, children }: Props) {
  return (
    <Text color={selected ? "cyan" : undefined} dimColor={dim}>
      {selected ? "> " : "  "}
      {children}
    </Text>
  );
}
