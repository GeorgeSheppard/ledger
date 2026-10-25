import { samePeriod, type Period } from './period';

const MAX_HISTORY = 50;

/** The shown range (`null` until one is picked) and the ranges it replaced, oldest first. */
export interface PeriodHistory {
  picked: Period | null;
  past: Period[];
}

export const emptyHistory: PeriodHistory = { picked: null, past: [] };

/** Shows `next`, remembering what was shown (`initial` before the first pick) to go back to. */
export function selectPeriod(
  h: PeriodHistory,
  initial: Period | null,
  next: Period
): PeriodHistory {
  const current = h.picked ?? initial;
  if (current && samePeriod(current, next)) return h;
  const past = current ? [...h.past, current].slice(-MAX_HISTORY) : h.past;
  return { picked: next, past };
}

/** Returns to the range before the last change, leaving it as is when there is none. */
export function goBack(h: PeriodHistory): PeriodHistory {
  const previous = h.past.at(-1);
  return previous ? { picked: previous, past: h.past.slice(0, -1) } : h;
}
