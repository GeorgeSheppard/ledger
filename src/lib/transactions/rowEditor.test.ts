import { describe, expect, it } from 'vitest';
import {
  initialRowEditorState,
  neighbourAfterRemoval,
  rowEditorReducer as reduce,
  type RowEditorState,
} from './rowEditor';

const ids = ['a', 'b', 'c'];

describe('rowEditorReducer', () => {
  it('moves the selection and clamps at the ends', () => {
    let state = reduce(initialRowEditorState, { type: 'move', delta: 1, ids });
    expect(state.selectedId).toBe('a');
    state = reduce(state, { type: 'move', delta: -1, ids });
    expect(state.selectedId).toBe('a');
    state = reduce(reduce(state, { type: 'move', delta: 5, ids }), { type: 'move', delta: 1, ids });
    expect(state.selectedId).toBe('c');
    expect(reduce(initialRowEditorState, { type: 'move', delta: -1, ids }).selectedId).toBe('c');
  });

  it('edits the selected row and ignores navigation while editing', () => {
    let state: RowEditorState = { selectedId: 'b', mode: { kind: 'browse' } };
    state = reduce(state, { type: 'edit' });
    expect(state.mode).toEqual({ kind: 'edit', id: 'b' });
    expect(reduce(state, { type: 'move', delta: 1, ids })).toBe(state);
    expect(reduce(state, { type: 'new' })).toBe(state);
    expect(reduce(state, { type: 'select', id: 'c' })).toBe(state);
    expect(reduce(state, { type: 'cancel' }).mode).toEqual({ kind: 'browse' });
  });

  it('does nothing on edit or delete without a selection', () => {
    expect(reduce(initialRowEditorState, { type: 'edit' })).toBe(initialRowEditorState);
    expect(reduce(initialRowEditorState, { type: 'confirm-delete' })).toBe(initialRowEditorState);
  });

  it('cancel clears the selection when already browsing', () => {
    const state: RowEditorState = { selectedId: 'a', mode: { kind: 'browse' } };
    expect(reduce(state, { type: 'cancel' }).selectedId).toBeNull();
  });

  it('confirms deletes and finishes writes', () => {
    let state = reduce({ selectedId: 'a', mode: { kind: 'browse' } }, { type: 'confirm-delete' });
    expect(state.mode).toEqual({ kind: 'confirm-delete', id: 'a' });
    state = reduce(state, { type: 'done', selectId: 'b' });
    expect(state).toEqual({ selectedId: 'b', mode: { kind: 'browse' } });
    state = reduce(reduce(state, { type: 'new' }), { type: 'done' });
    expect(state).toEqual({ selectedId: 'b', mode: { kind: 'browse' } });
  });

  it('finds a neighbour after removal', () => {
    expect(neighbourAfterRemoval(ids, 'b')).toBe('c');
    expect(neighbourAfterRemoval(ids, 'c')).toBe('b');
    expect(neighbourAfterRemoval(['a'], 'a')).toBeNull();
  });
});
