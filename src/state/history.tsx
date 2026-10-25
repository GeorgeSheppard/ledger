import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CommandStack, HistoryState } from '../lib/commands/commandStack';
import { useLedgerStore } from './ledgerData';

/** The undo history shared by the whole app. Record view changes on it; edits record themselves. */
export function useHistory(): CommandStack {
  return useLedgerStore().history;
}

/** What Ctrl+Z and Ctrl+Shift+Z would do right now, and the last thing they did. */
export function useHistoryState(): HistoryState {
  const history = useHistory();
  return useSyncExternalStore(history.subscribe, history.getState);
}

/**
 * State whose changes can be undone with Ctrl+Z. `set(next, label)` records "label" in the history.
 * The changes are forgotten when the screen using this goes away, since they would have nothing
 * left to change. `scope` names that screen.
 */
export function useUndoableState<T>(
  initial: T,
  scope: string
): [T, (next: T, label: string) => void] {
  const history = useHistory();
  const [value, setValue] = useState(initial);
  const latest = useRef(value);
  useEffect(() => () => history.drop(scope), [history, scope]);
  const set = useCallback(
    (next: T, label: string) => {
      const before = latest.current;
      if (Object.is(before, next)) return;
      const apply = (to: T) => {
        latest.current = to;
        setValue(to);
      };
      apply(next);
      history.record({ label, scope, undo: () => apply(before), redo: () => apply(next) });
    },
    [history, scope]
  );
  return [value, set];
}

const NOTICE_MS = 3500;

/** The last undo or redo, for a few seconds: "Undid: Delete 3 transactions". */
export function useHistoryNotice(): string | null {
  const { last } = useHistoryState();
  const [dismissed, setDismissed] = useState<number | null>(null);
  const id = last?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(() => setDismissed(id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [id]);
  if (!last || dismissed === last.id) return null;
  return `${last.kind === 'undo' ? 'Undid' : 'Redid'}: ${last.label}`;
}
