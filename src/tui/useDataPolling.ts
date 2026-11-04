import { useEffect, useRef } from "react";
import { getDataVersion } from "../core/db";
import { getSharedDb } from "./sharedDb";

/**
 * Calls `refresh` once on mount, then whenever the database changes, polling
 * SQLite's data_version every second (it only moves for writes from other
 * connections, so a hook that writes itself calls `refresh` directly too).
 * `deps` restarts the loop; list anything `refresh` closes over, or the poll
 * keeps calling a stale copy. `alsoWhen` forces a refresh for a non-database
 * reason, like the date rolling over.
 */
export function useDataPolling(
  refresh: () => void,
  deps: unknown[],
  alsoWhen?: () => boolean,
): void {
  const lastVersionRef = useRef<number | null>(null);

  useEffect(() => {
    const db = getSharedDb();
    refresh();
    const interval = setInterval(() => {
      const version = getDataVersion(db);
      if (version !== lastVersionRef.current || alsoWhen?.()) {
        lastVersionRef.current = version;
        refresh();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, deps);
}
