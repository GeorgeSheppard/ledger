import type { IsoDate } from '../domain/types';
import { isIsoDate } from '../transactions/dates';

/**
 * Paychecks: money earned before tax, the lines taken out of it, and where the rest lands. Plain
 * data and pure functions only. Saved in the spreadsheet's `_Paychecks` tab (see `./serialize.ts`).
 *
 * Paychecks vary a lot, so nothing here knows about any particular tax: a deduction is just a
 * name and an amount.
 */

export const REPEATS = ['none', 'weekly', 'every2weeks', 'every4weeks', 'monthly', 'yearly'] as const;
export type Repeat = (typeof REPEATS)[number];

export const REPEAT_LABELS: Record<Repeat, string> = {
  none: 'Once',
  weekly: 'Every week',
  every2weeks: 'Every 2 weeks',
  every4weeks: 'Every 4 weeks',
  monthly: 'Every month',
  yearly: 'Every year',
};

/** One line taken out of gross pay: income tax, student loan, pension, a union fee... */
export interface Deduction {
  /** Unique within its paycheck. */
  id: string;
  name: string;
  /** Per payment, never negative. */
  amount: number;
}

export interface Paycheck {
  /** Unique within the list. */
  id: string;
  /** Where the money comes from, e.g. "Acme salary". */
  name: string;
  /** The date of the first (or only) payment. */
  date: IsoDate;
  /** Pay before anything is taken out, per payment. */
  gross: number;
  deductions: Deduction[];
  /** The account the take-home pay lands in. `null` means the first account. */
  accountId: number | null;
  repeat: Repeat;
  /** The last date a repeating paycheck can pay on. `null` means it carries on. */
  until: IsoDate | null;
}

export interface PaycheckList {
  paychecks: Paycheck[];
}

/** Money is kept to whole cents so sums do not drift. */
export function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function totalDeductions(paycheck: Pick<Paycheck, 'deductions'>): number {
  return round(paycheck.deductions.reduce((sum, d) => sum + d.amount, 0));
}

/** Take-home pay per payment: gross less every deduction. */
export function netPay(paycheck: Pick<Paycheck, 'gross' | 'deductions'>): number {
  return round(paycheck.gross - totalDeductions(paycheck));
}

/** An id not used by any of `existing`. */
export function newId(existing: readonly { id: string }[], prefix: string): string {
  const used = new Set(existing.map((item) => item.id));
  for (let n = existing.length + 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

export function newDeduction(existing: readonly Deduction[], name = '', amount = 0): Deduction {
  return { id: newId(existing, 'd'), name, amount };
}

/** A blank paycheck starting on `date`. */
export function newPaycheck(existing: readonly Paycheck[], date: IsoDate): Paycheck {
  return {
    id: newId(existing, 'p'),
    name: '',
    date,
    gross: 0,
    deductions: [],
    accountId: null,
    repeat: 'monthly',
    until: null,
  };
}

/** What is wrong with a paycheck, in words, or null when it can be saved. */
export function paycheckProblem(paycheck: Paycheck): string | null {
  if (!paycheck.name.trim()) return 'Give the paycheck a name.';
  if (!isIsoDate(paycheck.date)) return 'Pick a date.';
  if (!(paycheck.gross > 0)) return 'Gross pay must be more than zero.';
  if (paycheck.until !== null && !isIsoDate(paycheck.until)) return 'The end date is not a date.';
  if (paycheck.until !== null && paycheck.until < paycheck.date)
    return 'The end date is before the first payment.';
  if (paycheck.deductions.some((d) => !(d.amount >= 0))) return 'Deductions cannot be negative.';
  if (paycheck.deductions.some((d) => d.amount > 0 && !d.name.trim()))
    return 'Name every deduction.';
  if (netPay(paycheck) < 0) return 'Deductions are more than gross pay.';
  return null;
}

/** Drops blank deduction lines and trims names, ready to save. */
export function tidyPaycheck(paycheck: Paycheck): Paycheck {
  return {
    ...paycheck,
    name: paycheck.name.trim(),
    deductions: paycheck.deductions
      .filter((d) => d.name.trim() !== '' || d.amount !== 0)
      .map((d) => ({ ...d, name: d.name.trim() })),
  };
}

export function addPaycheck(list: PaycheckList, paycheck: Paycheck): PaycheckList {
  return { paychecks: [...list.paychecks, paycheck] };
}

export function replacePaycheck(list: PaycheckList, paycheck: Paycheck): PaycheckList {
  return { paychecks: list.paychecks.map((p) => (p.id === paycheck.id ? paycheck : p)) };
}

export function removePaycheck(list: PaycheckList, id: string): PaycheckList {
  return { paychecks: list.paychecks.filter((p) => p.id !== id) };
}

// --- Schedule ---

const DAY_MS = 24 * 60 * 60 * 1000;

function toDay(date: IsoDate): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function fromDay(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

const STEP_DAYS: Partial<Record<Repeat, number>> = {
  weekly: 7,
  every2weeks: 14,
  every4weeks: 28,
};

/** Day `day` of a month, or its last day when the month is shorter (the 31st becomes the 30th). */
function clampedDate(year: number, monthIndex: number, day: number): IsoDate {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(monthIndex + 1)}-${pad(Math.min(day, last))}`;
}

/**
 * Every date the paycheck pays on between `from` and `to` (inclusive), oldest first. A monthly
 * paycheck keeps its day of the month, using the last day of shorter months.
 */
export function paymentDates(paycheck: Paycheck, from: IsoDate, to: IsoDate): IsoDate[] {
  if (!isIsoDate(paycheck.date)) return [];
  const end = paycheck.until !== null && paycheck.until < to ? paycheck.until : to;
  const dates: IsoDate[] = [];
  const keep = (date: IsoDate) => {
    if (date >= from && date <= end) dates.push(date);
  };

  if (paycheck.repeat === 'none') {
    keep(paycheck.date);
    return dates;
  }
  const step = STEP_DAYS[paycheck.repeat];
  if (step !== undefined) {
    const first = toDay(paycheck.date);
    // Skip straight to the first payment on or after `from` rather than walking from the start.
    const skipped = Math.max(0, Math.floor((toDay(from) - first) / step));
    for (let day = first + skipped * step; day <= toDay(end); day += step) keep(fromDay(day));
    return dates;
  }

  const year = Number(paycheck.date.slice(0, 4));
  const month = Number(paycheck.date.slice(5, 7)) - 1;
  const day = Number(paycheck.date.slice(8, 10));
  const stride = paycheck.repeat === 'yearly' ? 12 : 1;
  for (let n = 0; ; n++) {
    const index = year * 12 + month + n * stride;
    const date = clampedDate(Math.floor(index / 12), index % 12, day);
    if (date > end) break;
    keep(date);
  }
  return dates;
}
