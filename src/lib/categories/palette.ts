import type { Category } from '../domain/types';

/** Colours offered for new categories, chosen to read well on light and dark backgrounds. */
export const CATEGORY_PALETTE = [
  '#4f7cff',
  '#2f9e6b',
  '#e8913a',
  '#8e6bd6',
  '#d9534f',
  '#3aa6b9',
  '#c2577f',
  '#b59a2a',
  '#5b8a3a',
  '#7a7f8c',
] as const;

/** Colour for categories that are not in the list (e.g. typed directly into the sheet). */
export const UNKNOWN_CATEGORY_COLOR = '#9097a3';

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

/** The first palette colour not yet used, or a rotation through the palette once all are taken. */
export function nextCategoryColor(categories: readonly Category[]): string {
  const used = new Set(categories.map((c) => c.color.toLowerCase()));
  return (
    CATEGORY_PALETTE.find((color) => !used.has(color)) ??
    CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length]!
  );
}

/**
 * A colour for `name` that is the same every time: the palette entry its name hashes to, or the
 * next free one after it when `taken` already uses that colour.
 */
export function stableCategoryColor(name: string, taken: ReadonlySet<string> = new Set()): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const start = hash % CATEGORY_PALETTE.length;
  for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
    const color = CATEGORY_PALETTE[(start + i) % CATEGORY_PALETTE.length]!;
    if (!taken.has(color)) return color;
  }
  return CATEGORY_PALETTE[start]!;
}
