import { scaleBand, scaleLinear } from 'd3-scale';

/** Small geometry helpers for the SVG charts: d3 scales plus the rounded-bar path. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  ticks: number[];
}

/**
 * Maps values in `[min, max]` (widened to round tick values) onto `[rangeStart, rangeEnd]`. Flat
 * data is widened to include zero so there is something to draw.
 */
export function linearScale(
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number,
  tickCount = 4
): LinearScale {
  if (min === max) [min, max] = min === 0 ? [0, 1] : min > 0 ? [0, min] : [min, 0];
  const scale = scaleLinear().domain([min, max]).nice(tickCount).range([rangeStart, rangeEnd]);
  const result = ((value: number) => scale(value)) as LinearScale;
  result.domain = scale.domain() as [number, number];
  result.ticks = scale.ticks(tickCount).map((t) => (Object.is(t, -0) ? 0 : t));
  return result;
}

/** Centre x of slot `index` when `count` equal slots share `[start, end]`. */
export function bandCenter(index: number, count: number, start: number, end: number): number {
  const band = scaleBand<number>()
    .domain(Array.from({ length: count }, (_, i) => i))
    .range([start, end]);
  return (band(index) ?? start) + band.bandwidth() / 2;
}

/** Path for a bar with rounded corners on the end away from the baseline only. */
export function barPath(
  x: number,
  width: number,
  baseline: number,
  end: number,
  radius = 4
): string {
  const height = Math.abs(end - baseline);
  if (height === 0) return '';
  const r = Math.min(radius, width / 2, height);
  const up = end < baseline;
  const tip = end;
  const dir = up ? 1 : -1; // moves from the tip back toward the baseline
  return [
    `M${x},${baseline}`,
    `V${tip + dir * r}`,
    `Q${x},${tip} ${x + r},${tip}`,
    `H${x + width - r}`,
    `Q${x + width},${tip} ${x + width},${tip + dir * r}`,
    `V${baseline}`,
    'Z',
  ].join(' ');
}
