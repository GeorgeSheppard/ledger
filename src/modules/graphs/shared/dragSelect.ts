import type { Chart, ChartType, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef } from 'react';
import { dayStart, DAY_MS, isoDateOf } from '../../../lib/metrics/buckets';
import type { Period } from '../../../lib/metrics/period';
import type { ChartColors } from './chartjs';

/** Pixels the pointer must move before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** Chart.js events a drag needs on top of the usual ones. */
export const DRAG_EVENTS = ['mousemove', 'mouseout', 'mousedown', 'mouseup', 'click'] as const;

interface DragSelect {
  plugin: Plugin;
  /** True once, right after a drag ends, so the click that follows it can be ignored. */
  wasDrag(): boolean;
}

/**
 * Lets the pointer drag across a time chart to pick dates, shading the days covered as it goes.
 * With `mark`, the chart's own period is shaded too. Needs `DRAG_EVENTS` in the chart's `events`.
 */
export function useDragSelect(
  colors: ChartColors,
  onSelectPeriod: (period: Period) => void,
  mark?: Period
): DragSelect {
  // The plugin outlives renders, so it reads what it needs from a ref.
  const live = useRef({ mark, onSelectPeriod, fill: colors.surfaceHover, stroke: colors.accent });
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    live.current = { mark, onSelectPeriod, fill: colors.surfaceHover, stroke: colors.accent };
    // The marked period is drawn by the plugin, so a new one needs a repaint.
    chart.current?.draw();
  });
  return useMemo(() => {
    const state: {
      drag: { from: number; to: number; startPixel: number } | null;
      dragged: boolean;
    } = { drag: null, dragged: false };
    const band = (c: Chart, from: number, to: number) => {
      const x = c.scales.x!;
      const { chartArea } = c;
      const [a, b] = [x.getPixelForValue(from), x.getPixelForValue(to)].sort((m, n) => m - n) as [
        number,
        number,
      ];
      const left = Math.max(chartArea.left, a);
      const right = Math.min(chartArea.right, b);
      return {
        left,
        width: Math.max(right - left, 1),
        top: chartArea.top,
        height: chartArea.height,
      };
    };
    const plugin: Plugin<ChartType> = {
      id: 'dragSelect',
      beforeInit(c) {
        chart.current = c;
      },
      beforeDatasetsDraw(c) {
        const { mark: m, fill, stroke } = live.current;
        if (!m) return;
        const b = band(c, dayStart(m.from), dayStart(m.to) + DAY_MS);
        c.ctx.save();
        c.ctx.fillStyle = fill;
        c.ctx.strokeStyle = stroke;
        c.ctx.fillRect(b.left, b.top, b.width, b.height);
        c.ctx.strokeRect(b.left, b.top, b.width, b.height);
        c.ctx.restore();
      },
      afterDatasetsDraw(c) {
        const { drag } = state;
        if (!drag) return;
        const b = band(c, drag.from, drag.to);
        c.ctx.save();
        c.ctx.fillStyle = `${live.current.stroke}33`;
        c.ctx.fillRect(b.left, b.top, b.width, b.height);
        c.ctx.restore();
      },
      afterEvent(c, { event }) {
        const x = c.scales.x;
        if (!x) return;
        const pixel = Math.max(c.chartArea.left, Math.min(c.chartArea.right, event.x ?? 0));
        const time = x.getValueForPixel(pixel) ?? 0;
        if (event.type === 'mousedown') {
          state.drag = { from: time, to: time, startPixel: pixel };
          state.dragged = false;
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
            state.dragged = true;
            live.current.onSelectPeriod({ from: isoDateOf(a), to: isoDateOf(b) });
          }
          c.draw();
        }
      },
    };
    return {
      plugin,
      wasDrag() {
        const was = state.dragged;
        state.dragged = false;
        return was;
      },
    };
  }, []);
}
