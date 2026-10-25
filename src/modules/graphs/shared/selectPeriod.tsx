import type { Chart, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { dayStart, DAY_MS, isoDateOf } from '../../../lib/metrics/buckets';
import type { Period } from '../../../lib/metrics/period';

/** Pixels the pointer must move before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** The events a chart must listen to for drag-to-select. */
export const SELECT_EVENTS = ['mousemove', 'mouseout', 'mousedown', 'mouseup', 'click'] as const;

interface SelectColors {
  /** Fill of the marked period. */
  fill: string;
  /** Outline of the marked period, and the tint of a drag in progress. */
  stroke: string;
}

/**
 * Drag across a time graph to pick a new period. Pass `period` to also mark the dates currently
 * shown (the balances graph covers more than the period). `justDragged` lets a graph with its own
 * click action ignore the click that ends a drag.
 */
export function useSelectPeriod<T extends 'line' | 'bar', D>(
  chart: RefObject<Chart<T, D> | null>,
  options: {
    onSelectPeriod(period: Period): void;
    period?: Period;
    colors: SelectColors;
  }
) {
  // The plugin outlives renders, so it reads what it needs from a ref.
  const live = useRef(options);
  const dragged = useRef(false);
  useEffect(() => {
    live.current = options;
    // The marked period is drawn by the plugin, so a new one needs a repaint.
    chart.current?.draw();
  });

  const plugin = useMemo<Plugin<T>>(() => {
    const state: { drag: { from: number; to: number; startPixel: number } | null } = { drag: null };
    const band = (c: Chart, from: number, to: number) => {
      const x = c.scales.x!;
      const { chartArea } = c;
      const a = x.getPixelForValue(from);
      const b = x.getPixelForValue(to);
      const left = Math.max(chartArea.left, Math.min(a, b));
      const right = Math.min(chartArea.right, Math.max(a, b));
      return {
        left,
        width: Math.max(right - left, 1),
        top: chartArea.top,
        height: chartArea.height,
      };
    };
    // Typed loosely: the plugin is shared by line and bar charts.
    const plugin: Plugin = {
      id: 'selectPeriod',
      beforeDatasetsDraw(c) {
        const { period, colors } = live.current;
        if (!period) return;
        const b = band(c, dayStart(period.from), dayStart(period.to) + DAY_MS);
        const { ctx } = c;
        ctx.save();
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.fillRect(b.left, b.top, b.width, b.height);
        ctx.strokeRect(b.left, b.top, b.width, b.height);
        ctx.restore();
      },
      afterDatasetsDraw(c) {
        const { drag } = state;
        if (!drag) return;
        const b = band(c, drag.from, drag.to);
        c.ctx.save();
        c.ctx.fillStyle = `${live.current.colors.stroke}33`;
        c.ctx.fillRect(b.left, b.top, b.width, b.height);
        c.ctx.restore();
      },
      afterEvent(c, { event }) {
        const x = c.scales.x;
        if (!x) return;
        const pixel = Math.max(c.chartArea.left, Math.min(c.chartArea.right, event.x ?? 0));
        const time = x.getValueForPixel(pixel) ?? 0;
        if (event.type === 'mousedown') {
          dragged.current = false;
          state.drag = { from: time, to: time, startPixel: pixel };
        } else if (event.type === 'mousemove' && state.drag) {
          state.drag.to = time;
          c.draw();
        } else if (event.type === 'mouseout') {
          state.drag = null;
          c.draw();
        } else if (event.type === 'mouseup' && state.drag) {
          const { drag } = state;
          const [a, b] = [drag.from, drag.to].sort((m, n) => m - n) as [number, number];
          state.drag = null;
          if (Math.abs(pixel - drag.startPixel) >= DRAG_THRESHOLD) {
            dragged.current = true;
            live.current.onSelectPeriod({ from: isoDateOf(a), to: isoDateOf(b) });
          }
          c.draw();
        }
      },
    };
    return plugin as Plugin<T>;
  }, []);

  return { plugin, justDragged: () => dragged.current };
}
