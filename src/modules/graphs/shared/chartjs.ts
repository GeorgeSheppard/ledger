import {
  BarController,
  BarElement,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
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
  Filler
);
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
