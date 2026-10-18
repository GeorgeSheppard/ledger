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
