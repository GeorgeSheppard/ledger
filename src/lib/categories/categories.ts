import type { Category, Transaction } from '../domain/types';
import {
  isHexColor,
  nextCategoryColor,
  stableCategoryColor,
  UNKNOWN_CATEGORY_COLOR,
} from './palette';

/**
 * Operations on the category list. Every function returns a new list and leaves its input alone;
 * the caller saves the result with `repository.saveCategories`. Names are matched
 * case-insensitively so "groceries" and "Groceries" cannot both exist.
 */

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findCategory(categories: readonly Category[], name: string): Category | undefined {
  return categories.find((c) => sameName(c.name, name));
}

/** Lower-cased names of the categories excluded from calculations, for `excludedFromCashFlow`. */
export function ignoredCategoryNames(categories: readonly Category[]): Set<string> {
  return new Set(categories.filter((c) => c.excluded).map((c) => c.name.trim().toLowerCase()));
}

/** Turns "exclude from calculations" on or off for one category. */
export function setCategoryExcluded(
  categories: readonly Category[],
  name: string,
  excluded: boolean
): Category[] {
  return categories.map((c) => {
    if (!sameName(c.name, name)) return c;
    const next: Category = { name: c.name, color: c.color };
    return excluded ? { ...next, excluded: true } : next;
  });
}

export function categoryColor(categories: readonly Category[], name: string): string {
  return findCategory(categories, name)?.color ?? UNKNOWN_CATEGORY_COLOR;
}

/**
 * Why `name` is not acceptable, or null when it is. `current` is the category being renamed, which
 * may keep its own name (or change only its capitalisation).
 */
export function validateCategoryName(
  categories: readonly Category[],
  name: string,
  current?: string
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name';
  if (trimmed.length > 50) return 'Keep names under 50 characters';
  const clash = findCategory(categories, trimmed);
  if (clash && !(current !== undefined && sameName(clash.name, current)))
    return `"${clash.name}" already exists`;
  return null;
}

export function addCategory(
  categories: readonly Category[],
  name: string,
  color: string = nextCategoryColor(categories),
  excluded = false
): Category[] {
  const error = validateCategoryName(categories, name);
  if (error) throw new Error(error);
  if (!isHexColor(color)) throw new Error(`Invalid colour ${color}`);
  const added: Category = { name: name.trim(), color: color.toLowerCase() };
  return [...categories, excluded ? { ...added, excluded: true } : added];
}

export function recolorCategory(
  categories: readonly Category[],
  name: string,
  color: string
): Category[] {
  if (!isHexColor(color)) throw new Error(`Invalid colour ${color}`);
  return categories.map((c) => (sameName(c.name, name) ? { ...c, color: color.toLowerCase() } : c));
}

export function removeCategory(categories: readonly Category[], name: string): Category[] {
  return categories.filter((c) => !sameName(c.name, name));
}

/** Moves a category up or down the list (the order shown in pickers and charts). */
export function moveCategory(
  categories: readonly Category[],
  name: string,
  delta: number
): Category[] {
  const from = categories.findIndex((c) => sameName(c.name, name));
  if (from === -1) return [...categories];
  const to = Math.min(categories.length - 1, Math.max(0, from + delta));
  const next = [...categories];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** How many transactions use each category name, keyed by the lower-cased name. */
export function countUsage(transactions: readonly Transaction[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category.trim()) continue;
    const key = t.category.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function usageOf(counts: Map<string, number>, name: string): number {
  return counts.get(name.trim().toLowerCase()) ?? 0;
}

/**
 * Categories matching what the user typed in a picker: names starting with the query first, then
 * names containing it. An empty query returns everything in list order.
 */
export function searchCategories(categories: readonly Category[], query: string): Category[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...categories];
  const starts = categories.filter((c) => c.name.toLowerCase().startsWith(q));
  const contains = categories.filter(
    (c) => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q)
  );
  return [...starts, ...contains];
}

/**
 * The category list plus any category the transactions use that it lacks (a sheet with no
 * `_Categories` tab, or names typed straight into the sheet), and a colour for any entry without one.
 * New colours come from the palette by name, so they are the same on every load.
 */
export function completeCategories(
  categories: readonly Category[],
  transactions: Iterable<{ category: string }>
): Category[] {
  const known = new Set(categories.map((c) => c.name.trim().toLowerCase()));
  const used: string[] = [];
  for (const { category } of transactions) {
    const name = category.trim();
    if (name && !known.has(name.toLowerCase())) {
      known.add(name.toLowerCase());
      used.push(name);
    }
  }
  const all = [
    ...categories.map((c) => ({ ...c })),
    ...used.sort((a, b) => a.localeCompare(b)).map((name) => ({ name, color: '' })),
  ];
  const taken = new Set(all.filter((c) => isHexColor(c.color)).map((c) => c.color.toLowerCase()));
  for (const c of all) {
    if (isHexColor(c.color)) continue;
    c.color = stableCategoryColor(c.name, taken);
    taken.add(c.color);
  }
  return all;
}
