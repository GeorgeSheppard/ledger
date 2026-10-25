/**
 * The app's one undo history. Anything the user does that they might want back (an edit to the
 * spreadsheet, a date range picked on the dashboard) is recorded here as a `Command`, and Ctrl+Z
 * and Ctrl+Shift+Z walk it back and forth.
 *
 * A command is recorded after it has happened: it only knows how to reverse and repeat itself.
 * Commands must not depend on what ran in between (data edits restore whole snapshots, view
 * commands set an absolute value), so one can be dropped from the middle without breaking the rest.
 */

export interface Command {
  /** What it did, for the notice and button text: "Delete 3 transactions". */
  label: string;
  /** Commands belonging to a screen carry its name so they can be dropped when it goes away. */
  scope?: string;
  undo(): void;
  redo(): void;
}

/** What the UI needs, as one stable object for `useSyncExternalStore`. */
export interface HistoryState {
  /** The label of what Ctrl+Z would undo, or `null` when there is nothing to undo. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** The last undo or redo, so the UI can say "Undid: …". `id` changes with every one. */
  last: { id: number; kind: 'undo' | 'redo'; label: string } | null;
}

export const MAX_COMMANDS = 100;

export class CommandStack {
  private past: Command[] = [];
  private future: Command[] = [];
  private last: HistoryState['last'] = null;
  private performed = 0;
  private batching: Command[] | null = null;
  private state: HistoryState = { undoLabel: null, redoLabel: null, last: null };
  private readonly listeners = new Set<() => void>();

  getState = (): HistoryState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Adds something that has just happened. A new action ends any redo that was waiting. */
  record(command: Command): void {
    if (this.batching) {
      this.batching.push(command);
      return;
    }
    this.past = [...this.past, command].slice(-MAX_COMMANDS);
    this.future = [];
    this.publish();
  }

  /** Runs `act`, and makes everything it records one step to undo. */
  batch(label: string, act: () => void): void {
    if (this.batching) return act();
    const recorded: Command[] = (this.batching = []);
    try {
      act();
    } finally {
      this.batching = null;
    }
    if (recorded.length === 0) return;
    if (recorded.length === 1) return this.record({ ...recorded[0]!, label });
    this.record({
      label,
      scope: recorded.every((c) => c.scope === recorded[0]!.scope) ? recorded[0]!.scope : undefined,
      undo: () => [...recorded].reverse().forEach((c) => c.undo()),
      redo: () => recorded.forEach((c) => c.redo()),
    });
  }

  /** Reverses the latest command. Returns it, or `null` when there is nothing to undo. */
  undo(): Command | null {
    const command = this.past.at(-1);
    if (!command) return null;
    this.past = this.past.slice(0, -1);
    command.undo();
    this.future = [...this.future, command];
    this.finish('undo', command);
    return command;
  }

  redo(): Command | null {
    const command = this.future.at(-1);
    if (!command) return null;
    this.future = this.future.slice(0, -1);
    command.redo();
    this.past = [...this.past, command];
    this.finish('redo', command);
    return command;
  }

  /** Forgets the commands of a screen that is gone, since they could no longer be carried out. */
  drop(scope: string): void {
    const keep = (c: Command) => c.scope !== scope;
    if (this.past.every(keep) && this.future.every(keep)) return;
    this.past = this.past.filter(keep);
    this.future = this.future.filter(keep);
    this.publish();
  }

  private finish(kind: 'undo' | 'redo', command: Command) {
    this.last = { id: ++this.performed, kind, label: command.label };
    this.publish();
  }

  private publish() {
    this.state = {
      undoLabel: this.past.at(-1)?.label ?? null,
      redoLabel: this.future.at(-1)?.label ?? null,
      last: this.last,
    };
    for (const listener of this.listeners) listener();
  }
}
