import { useRef, useState } from "react";
import {
  type PersonalItemView,
  completePersonalItem,
  deletePersonalItem,
  listPersonalItems,
  toLocalDate,
  undoPersonalItem,
} from "../core/personal";
import { getSharedDb } from "./sharedDb";
import { useDataPolling } from "./useDataPolling";

export interface PersonalData {
  items: PersonalItemView[];
  complete: (id: number) => void;
  undo: (id: number) => void;
  remove: (id: number) => void;
}

/**
 * Refreshes when the local date changes as well as on database changes, so
 * "done today" and the week's progress reset overnight without a keypress.
 */
export function usePersonalData(): PersonalData {
  const [items, setItems] = useState<PersonalItemView[]>([]);
  const lastDayRef = useRef<string | null>(null);

  function refresh() {
    lastDayRef.current = toLocalDate();
    setItems(listPersonalItems(getSharedDb(), lastDayRef.current));
  }

  function complete(id: number) {
    completePersonalItem(getSharedDb(), id);
    refresh();
  }

  function undo(id: number) {
    undoPersonalItem(getSharedDb(), id);
    refresh();
  }

  function remove(id: number) {
    deletePersonalItem(getSharedDb(), id);
    refresh();
  }

  useDataPolling(refresh, [], () => toLocalDate() !== lastDayRef.current);

  return { items, complete, undo, remove };
}
