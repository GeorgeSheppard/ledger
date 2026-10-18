import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  layoutItems,
  scrollToReveal,
  visibleRange,
  type Layout,
  type Range,
} from '../../lib/virtual/window';

/** The nearest ancestor that scrolls, or null when the page itself does. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

interface WindowedList {
  /** Put on the element that holds the rows; it should be `layout.total` tall. */
  listRef: React.RefObject<HTMLDivElement | null>;
  layout: Layout;
  range: Range;
  /** Scrolls the page just enough to show item `index`. */
  reveal(index: number): void;
}

/**
 * Which items of a long list to render, following the page's own scroll (the list is not a scroll
 * box of its own, so the sticky page header and the browser's scrollbar behave as usual).
 * `heights` is each item's height in pixels. Items are positioned absolutely at their offset, so the
 * caller can also render one that is outside `range` (the row being edited, which must not unmount
 * while it holds focus).
 */
export function useWindowedList(heights: readonly number[]): WindowedList {
  const listRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutItems(heights), [heights]);
  const [range, setRange] = useState<Range>({ start: 0, end: Math.min(heights.length, 40) });

  /** Where the viewport sits relative to the top of the list. */
  const viewport = useCallback(() => {
    const list = listRef.current;
    if (!list) return null;
    const parent = scrollParent(list);
    const parentTop = parent ? parent.getBoundingClientRect().top : 0;
    const height = parent ? parent.clientHeight : window.innerHeight;
    return { top: parentTop - list.getBoundingClientRect().top, height, parent };
  }, []);

  const update = useCallback(() => {
    const view = viewport();
    if (!view) return;
    const next = visibleRange(layout, view.top, view.height);
    setRange((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, [layout, viewport]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const parent = scrollParent(list);
    const target: HTMLElement | Window = parent ?? window;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    target.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [update]);

  const reveal = useCallback(
    (index: number) => {
      const view = viewport();
      if (!view) return;
      const to = scrollToReveal(layout, index, view.top, view.height);
      if (to === null) return;
      const delta = to - view.top;
      if (view.parent) view.parent.scrollTop += delta;
      else window.scrollBy({ top: delta });
    },
    [layout, viewport]
  );

  const clamped = {
    start: Math.min(range.start, heights.length),
    end: Math.min(range.end, heights.length),
  };
  return { listRef, layout, range: clamped, reveal };
}
