import type { Transaction } from '../domain/types';

/**
 * Guesses the category of a new transaction from past ones. Transactions are grouped by note
 * (trimmed, case-insensitive, exact match) across every account, and the group's most common
 * category wins. Rows without a category are ignored, and a note never seen before gets no guess.
 */

export interface CategoryIndex {
  /**
   * The most common category for `note`, or `undefined` if no past transaction has it. Categories
   * for which `allowed` returns false are skipped, so the next most common one is used instead.
   */
  suggest(note: string, allowed?: (category: string) => boolean): string | undefined;
}

export function noteKey(note: string): string {
  return note.trim().toLowerCase();
}

interface Tally {
  count: number;
  /** Latest date (ISO, so string order is date order) the category was used on for this note. */
  latest: string;
}

/**
 * Ties go to the category used most recently, then to the one whose name sorts first, so the
 * answer never depends on the order of `past`.
 */
export function buildCategoryIndex(
  past: readonly Pick<Transaction, 'note' | 'category' | 'date'>[]
): CategoryIndex {
  const byNote = new Map<string, Map<string, Tally>>();
  for (const { note, category, date } of past) {
    const name = category.trim();
    const key = noteKey(note);
    if (!name || !key) continue;
    const tallies = byNote.get(key) ?? new Map<string, Tally>();
    const tally = tallies.get(name) ?? { count: 0, latest: '' };
    tally.count++;
    if (date > tally.latest) tally.latest = date;
    tallies.set(name, tally);
    byNote.set(key, tallies);
  }

  const ranking = new Map<string, string[]>();
  for (const [key, tallies] of byNote) {
    const ranked = [...tallies].sort(
      ([an, a], [bn, b]) =>
        b.count - a.count || b.latest.localeCompare(a.latest) || an.localeCompare(bn)
    );
    ranking.set(
      key,
      ranked.map(([name]) => name)
    );
  }
  return {
    suggest: (note, allowed) =>
      ranking.get(noteKey(note))?.find((name) => !allowed || allowed(name)),
  };
}
