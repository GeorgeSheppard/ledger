import { samePeriod, type Period } from './period';

const MAX_HISTORY = 50;

/** What `goBack` restores: the range and chosen categories at one moment. */
interface Snapshot {
  period: Period | null;
  categories: string[];
}

/**
 * The shown range (`null` until one is picked), the chosen categories, and what they were before
 * each change, oldest first. Accounts switched off are not part of it.
 */
export interface ViewHistory {
  picked: Period | null;
  categories: string[];
  past: Snapshot[];
}

export const emptyHistory: ViewHistory = { picked: null, categories: [], past: [] };

function remember(h: ViewHistory, initial: Period | null): Snapshot[] {
  return [...h.past, { period: h.picked ?? initial, categories: h.categories }].slice(-MAX_HISTORY);
}

/** Shows `next`, remembering what was shown (`initial` before the first pick) to go back to. */
export function selectPeriod(h: ViewHistory, initial: Period | null, next: Period): ViewHistory {
  const current = h.picked ?? initial;
  if (current && samePeriod(current, next)) return h;
  return { ...h, picked: next, past: remember(h, initial) };
}

/** Picks the category, or drops it when it is already chosen, as one step to go back over. */
export function toggleCategory(
  h: ViewHistory,
  initial: Period | null,
  category: string
): ViewHistory {
  const categories = h.categories.includes(category)
    ? h.categories.filter((c) => c !== category)
    : [...h.categories, category];
  return { ...h, categories, past: remember(h, initial) };
}

/** Drops every chosen category as one step; nothing happens when none are chosen. */
export function clearCategories(h: ViewHistory, initial: Period | null): ViewHistory {
  if (h.categories.length === 0) return h;
  return { ...h, categories: [], past: remember(h, initial) };
}

/** Returns to the range and categories before the last change, leaving it as is when there is none. */
export function goBack(h: ViewHistory): ViewHistory {
  const previous = h.past.at(-1);
  if (!previous) return h;
  return {
    picked: previous.period,
    categories: previous.categories,
    past: h.past.slice(0, -1),
  };
}
