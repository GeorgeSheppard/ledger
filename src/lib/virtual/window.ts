/**
 * Windowing for long lists: given each item's height and where the viewport is, which items need
 * to be in the DOM. Heights are known up front (rows are a fixed size, editors an estimate), so
 * nothing is measured and a list of 50,000 rows costs the same to show as one of 50.
 */

export interface Layout {
  /** Top edge of each item, plus a final entry for the total height. */
  offsets: number[];
  total: number;
}

export function layoutItems(heights: readonly number[]): Layout {
  const offsets = new Array<number>(heights.length + 1);
  let y = 0;
  for (let i = 0; i < heights.length; i++) {
    offsets[i] = y;
    y += heights[i]!;
  }
  offsets[heights.length] = y;
  return { offsets, total: y };
}

/** The index of the item containing `y` (binary search). Clamped to the first and last item. */
export function indexAt(layout: Layout, y: number): number {
  const last = layout.offsets.length - 2;
  if (last < 0) return 0;
  let lo = 0;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (layout.offsets[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface Range {
  /** First item to render. */
  start: number;
  /** One past the last item to render. */
  end: number;
}

/**
 * The items that intersect the viewport (`top` to `top + height`, relative to the list's top edge),
 * plus `overscan` pixels either side so fast scrolling does not show gaps.
 */
export function visibleRange(layout: Layout, top: number, height: number, overscan = 400): Range {
  const count = layout.offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const from = Math.max(0, top - overscan);
  const to = Math.min(layout.total, top + height + overscan);
  if (to < 0 || from > layout.total) return { start: 0, end: 0 };
  return { start: indexAt(layout, from), end: Math.min(count, indexAt(layout, to) + 1) };
}

/** The scroll position (relative to the list) that brings item `index` into view, or null if it already is. */
export function scrollToReveal(
  layout: Layout,
  index: number,
  top: number,
  height: number
): number | null {
  const itemTop = layout.offsets[index];
  const itemBottom = layout.offsets[index + 1];
  if (itemTop === undefined || itemBottom === undefined) return null;
  if (itemTop < top) return itemTop;
  if (itemBottom > top + height) return Math.max(0, itemBottom - height);
  return null;
}
