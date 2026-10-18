import type { MonthKey } from '../metrics/months';
import { addMonths, monthOf } from '../metrics/months';
import type { IsoDate } from '../domain/types';

/**
 * Paychecks: one entry per month, typed in from the payslip. A payslip is a few named income lines
 * (salary, an allowance, a bonus...) and a few named deduction lines (income tax, national
 * insurance, pension, student loan...); take-home pay is what is left. Plain data and pure
 * functions only. Saved in the spreadsheet's `_Paychecks` tab (see `./serialize.ts`).
 *
 * Payslips vary a lot, so nothing here knows about any particular tax or allowance: a line is just
 * a name and an amount.
 */

/** One line of a payslip: "Salary 3,000", "Income tax 540". */
export interface PayLine {
  /** Unique within its list of lines. */
  id: string;
  name: string;
  /** Never negative. */
  amount: number;
}

export interface Paycheck {
  /** The month the pay is for, `YYYY-MM`. At most one paycheck per month. */
  month: MonthKey;
  /** Money in before anything is taken out. */
  income: PayLine[];
  deductions: PayLine[];
}

export interface PaycheckList {
  /** Oldest month first. */
  paychecks: Paycheck[];
}

export type LineKind = 'income' | 'deductions';

/** Money is kept to whole cents so sums do not drift. */
export function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

const sum = (lines: readonly PayLine[]) => round(lines.reduce((total, l) => total + l.amount, 0));

/** Gross pay: every income line added up. */
export function totalIncome(paycheck: Pick<Paycheck, 'income'>): number {
  return sum(paycheck.income);
}

export function totalDeductions(paycheck: Pick<Paycheck, 'deductions'>): number {
  return sum(paycheck.deductions);
}

/** Take-home pay: income less every deduction. */
export function netPay(paycheck: Pick<Paycheck, 'income' | 'deductions'>): number {
  return round(totalIncome(paycheck) - totalDeductions(paycheck));
}

/** An id not used by any of `existing`. */
export function newId(existing: readonly { id: string }[], prefix: string): string {
  const used = new Set(existing.map((item) => item.id));
  for (let n = existing.length + 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

export function newLine(existing: readonly { id: string }[], name = '', amount = 0): PayLine {
  return { id: newId(existing, 'l'), name, amount };
}

/** The latest paycheck before `month`, or the latest of all when none is earlier. */
function lastBefore(list: PaycheckList, month: MonthKey): Paycheck | undefined {
  const earlier = list.paychecks.filter((p) => p.month < month);
  return earlier.at(-1) ?? list.paychecks.at(-1);
}

/** The month a new entry should start on: the one after the latest entry, else `today`'s. */
export function nextMonth(list: PaycheckList, today: IsoDate): MonthKey {
  const latest = list.paychecks.at(-1);
  return latest ? addMonths(latest.month, 1) : monthOf(today);
}

export function newPaycheck(month: MonthKey): Paycheck {
  return { month, income: [], deductions: [] };
}

/**
 * A paycheck for `month` with the same lines and amounts as the latest earlier one, ready to
 * adjust. Falls back to an empty paycheck when there is nothing to copy.
 */
export function copyPaycheck(list: PaycheckList, month: MonthKey): Paycheck {
  const from = lastBefore(list, month);
  if (!from) return newPaycheck(month);
  const fresh = (lines: PayLine[]) => lines.map((l, i) => ({ ...l, id: `l${i + 1}` }));
  return { month, income: fresh(from.income), deductions: fresh(from.deductions) };
}

/**
 * Names used before, most used first (ties: most recent first), for suggesting the next line.
 * One spelling per name, ignoring case.
 */
export function suggestedNames(list: PaycheckList, kind: LineKind): string[] {
  const seen = new Map<string, { name: string; count: number; last: MonthKey }>();
  for (const paycheck of list.paychecks)
    for (const line of paycheck[kind]) {
      const name = line.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const found = seen.get(key);
      if (found) {
        found.count++;
        found.last = paycheck.month;
        found.name = name;
      } else seen.set(key, { name, count: 1, last: paycheck.month });
    }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1) || a.name.localeCompare(b.name))
    .map((s) => s.name);
}

/**
 * What is wrong with a paycheck, in words, or null when it can be saved. `taken` are the months
 * already used by other entries.
 */
export function paycheckProblem(
  paycheck: Paycheck,
  taken: readonly MonthKey[] = []
): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(paycheck.month)) return 'Pick a month.';
  if (taken.includes(paycheck.month)) return 'There is already a paycheck for that month.';
  const lines = [...paycheck.income, ...paycheck.deductions];
  if (lines.some((l) => !(l.amount >= 0))) return 'Amounts cannot be negative.';
  if (lines.some((l) => l.amount > 0 && !l.name.trim())) return 'Name every line.';
  if (!(totalIncome(paycheck) > 0)) return 'Add some income.';
  if (netPay(paycheck) < 0) return 'Deductions are more than income.';
  return null;
}

/** Drops blank lines and trims names, ready to save. */
export function tidyPaycheck(paycheck: Paycheck): Paycheck {
  const tidy = (lines: PayLine[]) =>
    lines
      .filter((l) => l.name.trim() !== '' || l.amount !== 0)
      .map((l) => ({ ...l, name: l.name.trim() }));
  return { ...paycheck, income: tidy(paycheck.income), deductions: tidy(paycheck.deductions) };
}

const byMonth = (a: Paycheck, b: Paycheck) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0);

export function addPaycheck(list: PaycheckList, paycheck: Paycheck): PaycheckList {
  return { paychecks: [...list.paychecks, paycheck].sort(byMonth) };
}

/** Swaps the paycheck that was for `month` for `paycheck`, which may be for another month. */
export function replacePaycheck(
  list: PaycheckList,
  month: MonthKey,
  paycheck: Paycheck
): PaycheckList {
  return { paychecks: list.paychecks.map((p) => (p.month === month ? paycheck : p)).sort(byMonth) };
}

export function removePaycheck(list: PaycheckList, month: MonthKey): PaycheckList {
  return { paychecks: list.paychecks.filter((p) => p.month !== month) };
}
