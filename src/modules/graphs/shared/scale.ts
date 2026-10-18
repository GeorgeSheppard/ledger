/** Small, pure geometry helpers for the hand-drawn SVG charts. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  ticks: number[];
}

/** Round step (1, 2, 2.5 or 5 times a power of ten) giving about `count` intervals. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Evenly spaced round ticks covering `[min, max]`, always including zero when the range crosses or
 * touches it. Returns the ticks and the widened domain they span.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    if (min === 0) return [0, 1];
    [min, max] = min > 0 ? [0, min] : [min, 0];
  }
  const step = niceStep(max - min, count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  return ticks.map((t) => (Object.is(t, -0) ? 0 : t));
}

/** Maps values in `[min, max]` (widened to nice ticks) onto `[rangeStart, rangeEnd]`. */
export function linearScale(
  min: number,
  max: number,
  rangeStart: number,
  rangeEnd: number,
  tickCount = 4
): LinearScale {
  const ticks = niceTicks(min, max, tickCount);
  // niceTicks always returns at least two ticks.
  const lo = ticks[0]!;
  const hi = ticks.at(-1)!;
  const scale = ((value: number) =>
    rangeStart + ((value - lo) / (hi - lo)) * (rangeEnd - rangeStart)) as LinearScale;
  scale.domain = [lo, hi];
  scale.ticks = ticks;
  return scale;
}

/** Centre x of slot `index` when `count` equal slots share `[start, end]`. */
export function bandCenter(index: number, count: number, start: number, end: number): number {
  return start + ((index + 0.5) * (end - start)) / count;
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
