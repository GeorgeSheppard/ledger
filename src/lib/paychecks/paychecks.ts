import type { IsoDate } from '../domain/types';
import { isIsoDate } from '../transactions/dates';

/**
 * Paychecks: one entry per payslip, typed in by hand. There is no schedule and nothing repeats. A payslip is a few named income lines
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
  /** Unique within the list. */
  id: string;
  /** The day the pay arrived. Only decides which months of the dashboard count it. */
  date: IsoDate;
  /** Money in before anything is taken out. */
  income: PayLine[];
  /**
   * Taxable benefits in kind (a company car, health insurance): worth money and taxed as pay, but
   * not paid to you in cash. They count towards gross pay but not towards take-home pay.
   */
  benefits: PayLine[];
  deductions: PayLine[];
}

export interface PaycheckList {
  /** Oldest first. */
  paychecks: Paycheck[];
}

export type LineKind = 'income' | 'benefits' | 'deductions';

/** Money is kept to whole cents so sums do not drift. */
export function round(amount: number): number {
  return Math.round(amount * 100) / 100;
}

const sum = (lines: readonly PayLine[]) => round(lines.reduce((total, l) => total + l.amount, 0));

/** Cash paid: every income line added up. */
export function totalIncome(paycheck: Pick<Paycheck, 'income'>): number {
  return sum(paycheck.income);
}

export function totalBenefits(paycheck: Pick<Paycheck, 'benefits'>): number {
  return sum(paycheck.benefits);
}

/** Gross pay: what tax is worked out on, cash income plus benefits in kind. */
export function grossPay(paycheck: Pick<Paycheck, 'income' | 'benefits'>): number {
  return round(totalIncome(paycheck) + totalBenefits(paycheck));
}

export function totalDeductions(paycheck: Pick<Paycheck, 'deductions'>): number {
  return sum(paycheck.deductions);
}

/** Take-home pay: cash income less every deduction. Benefits in kind are not paid out. */
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

export function newPaycheck(list: PaycheckList, date: IsoDate): Paycheck {
  return { id: newId(list.paychecks, 'p'), date, income: [], benefits: [], deductions: [] };
}

/**
 * Names used before, most used first (ties: most recent first), for suggesting the next line.
 * One spelling per name, ignoring case.
 */
export function suggestedNames(list: PaycheckList, kind: LineKind): string[] {
  const seen = new Map<string, { name: string; count: number; last: IsoDate }>();
  for (const paycheck of list.paychecks)
    for (const line of paycheck[kind]) {
      const name = line.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const found = seen.get(key);
      if (found) {
        found.count++;
        found.last = paycheck.date;
        found.name = name;
      } else seen.set(key, { name, count: 1, last: paycheck.date });
    }
  return [...seen.values()]
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1) || a.name.localeCompare(b.name))
    .map((s) => s.name);
}

/** What is wrong with a paycheck, in words, or null when it can be saved. */
export function paycheckProblem(paycheck: Paycheck): string | null {
  if (!isIsoDate(paycheck.date)) return 'Pick a date.';
  const lines = [...paycheck.income, ...paycheck.benefits, ...paycheck.deductions];
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
  return {
    ...paycheck,
    income: tidy(paycheck.income),
    benefits: tidy(paycheck.benefits),
    deductions: tidy(paycheck.deductions),
  };
}

/** Oldest first; paychecks on the same day keep their order. */
const byDate = (a: Paycheck, b: Paycheck) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function addPaycheck(list: PaycheckList, paycheck: Paycheck): PaycheckList {
  return { paychecks: [...list.paychecks, paycheck].sort(byDate) };
}

export function replacePaycheck(list: PaycheckList, paycheck: Paycheck): PaycheckList {
  return {
    paychecks: list.paychecks.map((p) => (p.id === paycheck.id ? paycheck : p)).sort(byDate),
  };
}

export function removePaycheck(list: PaycheckList, id: string): PaycheckList {
  return { paychecks: list.paychecks.filter((p) => p.id !== id) };
}
