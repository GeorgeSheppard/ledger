import { describe, expect, it } from 'vitest';
import {
  clickSelection,
  moveSelection,
  noSelection,
  pruneSelection,
  selectAll,
  selectOnly,
} from './selection';

const shown = ['a', 'b', 'c', 'd', 'e'];

describe('clickSelection', () => {
  it('a plain click selects just that row', () => {
    const s = clickSelection(selectOnly('a'), shown, 'c');
    expect(s).toEqual({ ids: ['c'], anchor: 'c' });
  });

  it('ctrl+click toggles one row', () => {
    let s = clickSelection(noSelection, shown, 'b', { toggle: true });
    s = clickSelection(s, shown, 'd', { toggle: true });
    expect(s.ids).toEqual(['b', 'd']);
    s = clickSelection(s, shown, 'b', { toggle: true });
    expect(s.ids).toEqual(['d']);
  });

  it('shift+click selects the range from the anchor, either direction', () => {
    const start = selectOnly('b');
    expect(clickSelection(start, shown, 'd', { range: true }).ids).toEqual(['b', 'c', 'd']);
    expect(clickSelection(selectOnly('d'), shown, 'b', { range: true }).ids).toEqual([
      'b',
      'c',
      'd',
    ]);
  });

  it('shift+click keeps the anchor, so the range can be adjusted', () => {
    const wide = clickSelection(selectOnly('b'), shown, 'e', { range: true });
    expect(clickSelection(wide, shown, 'c', { range: true })).toEqual({
      ids: ['b', 'c'],
      anchor: 'b',
    });
  });

  it('ctrl+shift+click adds the range to what is selected', () => {
    const s = clickSelection({ ids: ['a', 'c'], anchor: 'c' }, shown, 'e', {
      range: true,
      toggle: true,
    });
    expect(s.ids).toEqual(['a', 'c', 'd', 'e']);
  });

  it('shift+click with no anchor just selects the row', () => {
    expect(clickSelection(noSelection, shown, 'c', { range: true }).ids).toEqual(['c']);
  });
});

describe('other selection helpers', () => {
  it('selects all', () => {
    expect(selectAll(shown).ids).toEqual(shown);
    expect(selectAll([])).toEqual(noSelection);
  });

  it('prunes rows that are no longer shown, keeping identity when nothing changes', () => {
    const s = { ids: ['a', 'c'], anchor: 'c' };
    expect(pruneSelection(s, shown)).toBe(s);
    expect(pruneSelection(s, ['a', 'b'])).toEqual({ ids: ['a'], anchor: 'a' });
    expect(pruneSelection(s, [])).toEqual(noSelection);
  });

  it('moves a single selection and clamps at the ends', () => {
    expect(moveSelection(noSelection, shown, 1).ids).toEqual(['a']);
    expect(moveSelection(noSelection, shown, -1).ids).toEqual(['e']);
    expect(moveSelection(selectOnly('b'), shown, 1).ids).toEqual(['c']);
    expect(moveSelection(selectOnly('e'), shown, 1).ids).toEqual(['e']);
    expect(moveSelection(selectOnly('gone'), shown, 1).ids).toEqual(['a']);
    expect(moveSelection(selectOnly('a'), [], 1).ids).toEqual(['a']);
  });
});
