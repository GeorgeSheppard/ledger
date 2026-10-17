/**
 * State for a keyboard-driven list where one row is selected and can be edited inline, a new row
 * can be added at the top, and deletion needs a confirmation. Shared by the transaction table and
 * the categories page. Rows are identified by string ids so selection survives re-reads.
 */

export type RowEditorMode =
  | { kind: 'browse' }
  | { kind: 'edit'; id: string }
  | { kind: 'new' }
  | { kind: 'confirm-delete'; id: string };

export interface RowEditorState {
  selectedId: string | null;
  mode: RowEditorMode;
}

export type RowEditorAction =
  | { type: 'select'; id: string | null }
  | { type: 'move'; delta: number; ids: readonly string[] }
  | { type: 'edit'; id?: string }
  | { type: 'new' }
  | { type: 'confirm-delete'; id?: string }
  | { type: 'cancel' }
  /** A write finished: back to browsing with `selectId` selected (if given). */
  | { type: 'done'; selectId?: string | null };

export const initialRowEditorState: RowEditorState = { selectedId: null, mode: { kind: 'browse' } };

export function isEditing(state: RowEditorState): boolean {
  return state.mode.kind === 'edit' || state.mode.kind === 'new';
}

export function rowEditorReducer(state: RowEditorState, action: RowEditorAction): RowEditorState {
  const browsing = state.mode.kind === 'browse';
  switch (action.type) {
    case 'select':
      if (isEditing(state) && action.id !== state.selectedId) return state;
      return { selectedId: action.id, mode: browsing ? state.mode : { kind: 'browse' } };
    case 'move': {
      if (!browsing || action.ids.length === 0) return state;
      const index = state.selectedId === null ? -1 : action.ids.indexOf(state.selectedId);
      const next =
        index === -1
          ? action.delta > 0
            ? 0
            : action.ids.length - 1
          : Math.min(action.ids.length - 1, Math.max(0, index + action.delta));
      return { ...state, selectedId: action.ids[next] ?? null };
    }
    case 'edit': {
      const id = action.id ?? state.selectedId;
      if (id === null || isEditing(state)) return state;
      return { selectedId: id, mode: { kind: 'edit', id } };
    }
    case 'new':
      if (isEditing(state)) return state;
      return { ...state, mode: { kind: 'new' } };
    case 'confirm-delete': {
      const id = action.id ?? state.selectedId;
      if (id === null || isEditing(state)) return state;
      return { selectedId: id, mode: { kind: 'confirm-delete', id } };
    }
    case 'cancel':
      return browsing ? { ...state, selectedId: null } : { ...state, mode: { kind: 'browse' } };
    case 'done':
      return {
        selectedId: action.selectId === undefined ? state.selectedId : action.selectId,
        mode: { kind: 'browse' },
      };
  }
}

/** After deleting `id`, the row to select: the one that took its place, else the one above. */
export function neighbourAfterRemoval(ids: readonly string[], id: string): string | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}
