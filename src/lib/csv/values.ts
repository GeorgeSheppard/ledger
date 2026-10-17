import type { IsoDate } from '../domain/types';

/**
 * Normalising the cell values banks put in CSV exports: dates in many layouts and amounts with
 * currency symbols, thousands separators, brackets for negatives and CR/DR suffixes.
 */

/**
 * How a date column is written. `dmy` and `mdy` accept `/`, `-` or `.` separators and two- or
 * four-digit years; `dmy-name` is `5 Oct 2026` or `05-Oct-26`.
 */
export type DateFormat = 'ymd' | 'dmy' | 'mdy' | 'dmy-name';

export const DATE_FORMATS: { id: DateFormat; label: string }[] = [
  { id: 'ymd', label: 'YYYY-MM-DD' },
  { id: 'dmy', label: 'DD/MM/YYYY' },
  { id: 'mdy', label: 'MM/DD/YYYY' },
  { id: 'dmy-name', label: 'D Mon YYYY' },
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function toIso(year: number, month: number, day: number): IsoDate | null {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Parses a date cell in the given format, ignoring any time part. Null if it does not fit. */
export function parseDate(value: string, format: DateFormat): IsoDate | null {
  const text = (value.trim().split(/[T\s](?=\d{1,2}:)/)[0] ?? '').trim();
  const numeric = (pattern: RegExp) => text.match(pattern)?.slice(1).map(Number) ?? null;
  switch (format) {
    case 'ymd': {
      const [y, m, d] = numeric(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/) ?? [];
      return y && m && d ? toIso(y, m, d) : null;
    }
    case 'dmy':
    case 'mdy': {
      const [a, b, y] = numeric(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/) ?? [];
      if (a === undefined || b === undefined || y === undefined) return null;
      return format === 'dmy' ? toIso(y, b, a) : toIso(y, a, b);
    }
    case 'dmy-name': {
      const [, d, name, y] =
        text.match(/^(\d{1,2})[\s\-/.]+([a-z]{3,9})\.?[\s\-/.,]+(\d{2}|\d{4})$/i) ?? [];
      const month = name ? MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1 : 0;
      return d && y && month ? toIso(Number(y), month, Number(d)) : null;
    }
  }
}

/**
 * The format that parses the most of `values` (blank cells ignored), or null if none parses any.
 * Ties go to the earlier format in `DATE_FORMATS`, so ambiguous `01/02/2026` is read day-first.
 */
export function detectDateFormat(values: readonly string[]): DateFormat | null {
  const filled = values.filter((v) => v.trim() !== '');
  let best: DateFormat | null = null;
  let bestCount = 0;
  for (const { id } of DATE_FORMATS) {
    const count = filled.filter((v) => parseDate(v, id) !== null).length;
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parses an amount cell to a number rounded to cents. Handles `£1,234.56`, `-12.30`, `(12.30)`,
 * `12.30-`, `12.30 DR` (negative) / `CR`, and decimal commas such as `1.234,56`. Blank cells and
 * text that is not a number give null.
 */
export function parseAmount(value: string): number | null {
  let text = value.trim().toLowerCase();
  if (text === '') return null;
  let negative = false;

  const suffix = text.match(/\s*(cr|dr)$/);
  if (suffix) {
    negative = suffix[1] === 'dr';
    text = text.slice(0, -suffix[0].length);
  }
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^\d.,+-]/g, '');
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  const decimalComma = /^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(text) || /^\d+,\d{1,2}$/.test(text);
  text = decimalComma ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null;

  const amount = Math.round(parseFloat(text) * 100) / 100;
  return negative && amount !== 0 ? -amount : amount;
}
