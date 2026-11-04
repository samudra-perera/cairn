import { useState } from "react";

/**
 * A cursor over a list of `length` rows. `index` is always in range even when
 * the list shrinks underneath it (after a delete or a refresh), and moving
 * starts from that clamped position, so the cursor never gets stuck past the end.
 */
export function useCursor(length: number) {
  const [raw, setRaw] = useState(0);
  const last = Math.max(0, length - 1);
  const index = Math.min(raw, last);

  return {
    index,
    set: setRaw,
    // Functional updates, clamped first, so quick repeated presses all count.
    next: () => setRaw((r) => Math.min(Math.min(r, last) + 1, last)),
    prev: () => setRaw((r) => Math.max(Math.min(r, last) - 1, 0)),
  };
}
