import type { Category } from '../domain/types';

/**
 * Colours offered for new categories. Picked by repeatedly taking the colour farthest (in the
 * perceptual OKLab space) from those already chosen, from a pool of mid-lightness colours, so any
 * prefix of the list is as spread out as it can be and each reads on both light and dark backgrounds.
 */
export const CATEGORY_PALETTE = [
  '#239382',
  '#fe7ccb',
  '#dba833',
  '#7e68e3',
  '#d64b30',
  '#46bdfe',
  '#19d27f',
  '#c44a9e',
  '#9a7c31',
  '#bb9dff',
  '#1387cc',
  '#fd8c7b',
  '#40970f',
  '#bd81b3',
  '#81a563',
  '#f05f81',
] as const;

/** Colour for categories that are not in the list (e.g. typed directly into the sheet). */
export const UNKNOWN_CATEGORY_COLOR = '#9097a3';

/** Colours closer than this in OKLab (about 0.1 is "clearly different") are treated as the same. */
const MIN_DISTANCE = 0.08;

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

type Lab = readonly [number, number, number];

function toLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** How different two hex colours look: 0 for identical, about 0.1 for clearly different. */
export function colorDistance(a: string, b: string): number {
  const [la, lb] = [toLab(a), toLab(b)];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

function nearestTaken(color: string, taken: readonly string[]): number {
  return taken.length ? Math.min(...taken.map((t) => colorDistance(color, t))) : Infinity;
}

/**
 * The palette colour to use next, scanning from `start`: the first that is not close to any colour
 * in `taken`, or once every one is close to something, the one that is farthest from them all.
 */
function pick(taken: readonly string[], start: number): string {
  let best: string = CATEGORY_PALETTE[start % CATEGORY_PALETTE.length]!;
  let bestGap = -1;
  for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
    const color = CATEGORY_PALETTE[(start + i) % CATEGORY_PALETTE.length]!;
    const gap = nearestTaken(color, taken);
    if (gap >= MIN_DISTANCE) return color;
    if (gap > bestGap) {
      best = color;
      bestGap = gap;
    }
  }
  return best;
}

/** The first palette colour clearly different from those in use. */
export function nextCategoryColor(categories: readonly Category[]): string {
  return pick(
    categories.filter((c) => isHexColor(c.color)).map((c) => c.color.toLowerCase()),
    0
  );
}

/**
 * A colour for `name` that is the same every time: the palette entry its name hashes to, or the
 * next one after it that is not close to a colour in `taken`.
 */
export function stableCategoryColor(name: string, taken: ReadonlySet<string> = new Set()): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return pick([...taken], hash % CATEGORY_PALETTE.length);
}
