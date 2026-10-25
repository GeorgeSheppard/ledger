import {
  BarController,
  BarElement,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartType,
  type TooltipPositionerFunction,
} from 'chart.js';
import { useEffect, useState } from 'react';

/** Everything the graphs use from Chart.js, registered once so unused parts stay out of the bundle. */
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler
);
declare module 'chart.js' {
  interface TooltipPositionerMap {
    besideBar: TooltipPositionerFunction<ChartType>;
  }
}

/**
 * Puts a tooltip next to the bar under the pointer rather than on top of it, level with the
 * pointer, so the bar it describes stays in view. It opens to the left of bars in the right half.
 */
Tooltip.positioners.besideBar = function (items, eventPosition) {
  const element = items[0]?.element as { x: number; width?: number } | undefined;
  if (!element) return false;
  const { left, right } = this.chart.chartArea;
  const half = (element.width ?? 0) / 2;
  return element.x > (left + right) / 2
    ? { x: element.x - half - 6, y: eventPosition.y, xAlign: 'right', yAlign: 'center' }
    : { x: element.x + half + 6, y: eventPosition.y, xAlign: 'left', yAlign: 'center' };
};

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.animation = false;

/** The theme as plain colour strings, which a canvas needs (it cannot read `var(--…)`). */
export interface ChartColors {
  fg: string;
  muted: string;
  line: string;
  surface: string;
  surfaceHover: string;
  accent: string;
  positive: string;
  negative: string;
  /** Turns a theme colour (`var(--color-muted)`) or a hex colour into one a canvas can paint. */
  resolve(color: string): string;
}

function read(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--ledger-${name}`).trim();
}

function readColors(): ChartColors {
  return {
    fg: read('fg'),
    muted: read('muted'),
    line: read('line'),
    surface: read('surface'),
    surfaceHover: read('surface-hover'),
    accent: read('accent'),
    positive: read('positive'),
    negative: read('negative'),
    resolve: (color) => {
      const token = /^var\(--color-([\w-]+)\)$/.exec(color);
      return token ? read(token[1]!) || color : color;
    },
  };
}

/** The current theme colours; follows the light/dark setting. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState(readColors);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(readColors());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return colors;
}
