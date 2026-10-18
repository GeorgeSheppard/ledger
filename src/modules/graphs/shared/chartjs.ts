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
} from 'chart.js';
import { useEffect, useState } from 'react';

/** Everything the zoomable graphs use from Chart.js, registered once so unused parts stay out of the bundle. */
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
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.animation = false;

let zoomLoaded: Promise<void> | undefined;

/**
 * Pan and zoom come from a plugin that needs the browser, so it is loaded when a chart first
 * appears (which also keeps it out of the main bundle). Charts wait for this before drawing. If it
 * cannot be loaded (offline, or a new release removed the file an open tab still points at) the
 * charts draw without pan and zoom rather than staying blank, and the next chart tries again.
 */
export function useChartsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const loading = (zoomLoaded ??= import('chartjs-plugin-zoom').then(({ default: plugin }) => {
      Chart.register(plugin);
    }));
    let current = true;
    const done = () => current && setReady(true);
    loading.then(done, () => {
      if (zoomLoaded === loading) zoomLoaded = undefined;
      done();
    });
    return () => {
      current = false;
    };
  }, []);
  return ready;
}

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
