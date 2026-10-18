/**
 * Which rows are selected, with the same rules as a file manager: a plain click selects one row,
 * Ctrl/⌘+click toggles a row, Shift+click selects the range from the last row clicked (the anchor).
 * Rows are string ids in the order they are shown, so ranges follow the table's current sort.
 */

export interface Selection {
  ids: readonly string[];
  /** The row a Shift+click extends from. */
  anchor: string | null;
}

export const noSelection: Selection = { ids: [], anchor: null };

export interface ClickModifiers {
  toggle?: boolean;
  range?: boolean;
}

export function selectOnly(id: string | null): Selection {
  return id === null ? noSelection : { ids: [id], anchor: id };
}

/** The selection after a click on `id`. `shown` is every row id in display order. */
export function clickSelection(
  selection: Selection,
  shown: readonly string[],
  id: string,
  { toggle = false, range = false }: ClickModifiers = {}
): Selection {
  if (range && selection.anchor !== null) {
    const from = shown.indexOf(selection.anchor);
    const to = shown.indexOf(id);
    if (from !== -1 && to !== -1) {
      const span = shown.slice(Math.min(from, to), Math.max(from, to) + 1);
      // Ctrl+Shift adds the range to what is already selected; Shift alone replaces it.
      const ids = toggle ? [...new Set([...selection.ids, ...span])] : span;
      return { ids, anchor: selection.anchor };
    }
  }
  if (toggle) {
    const ids = selection.ids.includes(id)
      ? selection.ids.filter((x) => x !== id)
      : [...selection.ids, id];
    return { ids, anchor: id };
  }
  return selectOnly(id);
}

export function selectAll(shown: readonly string[]): Selection {
  return { ids: [...shown], anchor: shown[0] ?? null };
}

/** Drops ids that are no longer shown (deleted, or filtered out). Returns the same object if nothing changed. */
export function pruneSelection(selection: Selection, shown: readonly string[]): Selection {
  const visible = new Set(shown);
  const ids = selection.ids.filter((id) => visible.has(id));
  if (ids.length === selection.ids.length) return selection;
  return {
    ids,
    anchor:
      selection.anchor !== null && visible.has(selection.anchor)
        ? selection.anchor
        : (ids.at(-1) ?? null),
  };
}

/** Moves a single selection up or down the list (J/K). With nothing selected it starts at an end. */
export function moveSelection(
  selection: Selection,
  shown: readonly string[],
  delta: number
): Selection {
  if (shown.length === 0) return selection;
  const current = selection.anchor ?? selection.ids.at(-1) ?? null;
  const index = current === null ? -1 : shown.indexOf(current);
  const next =
    index === -1
      ? delta > 0
        ? 0
        : shown.length - 1
      : Math.min(shown.length - 1, Math.max(0, index + delta));
  return selectOnly(shown[next] ?? null);
}
