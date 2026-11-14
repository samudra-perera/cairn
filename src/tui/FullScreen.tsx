import type { ReactNode } from "react";
import { Box } from "ink";
import { useTerminalSize } from "./useTerminalSize";

/**
 * Sizes the whole UI to the terminal. One row is left spare on purpose: Ink
 * clears and redraws the entire screen on every update when its output is as
 * tall as the terminal, which flickers.
 */
export function FullScreen({ children }: { children: ReactNode }) {
  const { columns, rows } = useTerminalSize();
  return (
    <Box width={columns} height={Math.max(1, rows - 1)} flexDirection="column">
      {children}
    </Box>
  );
}
