/**
 * Parsing and formatting money amounts. Amounts are plain numbers rounded to cents: positive is
 * money in, negative is money out. There is no currency setting yet, so formatting shows numbers
 * only (grouped, two decimals) in the user's locale.
 */

/** Rounds to cents to keep float noise out of the sheet. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Parses what a user typed into an amount field. Accepts `-12.5`, `+12.50`, `1,234.56`, `£12`,
 * `(12.00)` (accounting negative) and `12-`. Returns null when the text is not a number.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/\s/g, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  s = s.replace(/^[^\d.,]+/, '').replace(/,/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const value = roundCents(Number(s));
  return negative && value !== 0 ? -value : value;
}

const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an amount for display, e.g. `1,234.50` or `−12.00` (true minus sign).
 * With `signed`, positive amounts get a leading `+`.
 */
export function formatAmount(value: number, { signed = false } = {}): string {
  const text = formatter.format(Math.abs(value));
  if (value < 0) return `−${text}`;
  if (signed && value > 0) return `+${text}`;
  return text;
}

/** The text an amount field starts with when editing an existing value. */
export function amountToInput(value: number): string {
  return String(roundCents(value));
}
