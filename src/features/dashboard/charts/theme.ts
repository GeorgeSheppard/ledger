/**
 * Theme colours for chart marks that are set through `fill` / `style` rather than classes. These are
 * the shared theme tokens, so they follow light and dark mode. Category colours come from the data.
 */
export const INCOME_COLOR = 'var(--color-positive)';
export const SPENDING_COLOR = 'var(--color-negative)';
export const NET_COLOR = 'var(--color-fg)';
/** For categories missing from the category list, and uncategorised spending. */
export const FALLBACK_COLOR = 'var(--color-muted)';

/** Classes shared by the SVG charts. */
export const CHART_CLASSES = {
  frame: 'relative w-full',
  svg: 'block overflow-visible',
  axisLabel: 'fill-muted text-xs tabular-nums',
  valueLabel: 'fill-fg text-xs font-semibold',
  /** Markers carry a ring in the surface colour so they stay legible over lines. */
  dot: 'pointer-events-none stroke-surface stroke-2',
  crosshair: 'pointer-events-none stroke-muted/50',
  /** Invisible hover targets, wider than the marks they cover. */
  hit: 'fill-transparent',
} as const;
