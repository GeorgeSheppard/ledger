import { describe, expect, it } from 'vitest';
import { indexAt, layoutItems, scrollToReveal, visibleRange } from './window';

const layout = layoutItems([40, 44, 44, 44, 40, 44]);

describe('layoutItems', () => {
  it('stacks items and totals them', () => {
    expect(layout.offsets).toEqual([0, 40, 84, 128, 172, 212, 256]);
    expect(layout.total).toBe(256);
  });
});

describe('indexAt', () => {
  it('finds the item containing a position and clamps', () => {
    expect(indexAt(layout, 0)).toBe(0);
    expect(indexAt(layout, 39)).toBe(0);
    expect(indexAt(layout, 40)).toBe(1);
    expect(indexAt(layout, 9999)).toBe(5);
    expect(indexAt(layout, -50)).toBe(0);
  });
});

describe('visibleRange', () => {
  it('returns the items in view plus overscan', () => {
    expect(visibleRange(layout, 90, 50, 0)).toEqual({ start: 2, end: 4 });
    expect(visibleRange(layout, 90, 50, 100)).toEqual({ start: 0, end: 6 });
  });

  it('is empty for an empty list or a viewport past the end', () => {
    expect(visibleRange(layoutItems([]), 0, 500)).toEqual({ start: 0, end: 0 });
    expect(visibleRange(layout, 5000, 500, 0)).toEqual({ start: 0, end: 0 });
  });

  it('stays small for a huge list', () => {
    const big = layoutItems(Array.from({ length: 100_000 }, () => 44));
    const { start, end } = visibleRange(big, 2_200_000, 900);
    expect(end - start).toBeLessThan(60);
    expect(start).toBeGreaterThan(49_000);
  });
});

describe('scrollToReveal', () => {
  it('does nothing when the item is in view', () => {
    expect(scrollToReveal(layout, 2, 50, 200)).toBeNull();
  });
  it('scrolls up to an item above and down to one below', () => {
    expect(scrollToReveal(layout, 0, 50, 100)).toBe(0);
    expect(scrollToReveal(layout, 5, 0, 100)).toBe(156);
  });
  it('ignores an index that is not in the list', () => {
    expect(scrollToReveal(layout, 20, 0, 100)).toBeNull();
  });
});
