import { z } from 'zod';
import type { IsoDate } from '../domain/types';
import { isoDateSchema } from '../domain/schemas';
import { monthEnd } from '../metrics/months';
import { isIsoDate } from '../transactions/dates';
import { type PayLine, type Paycheck } from './paychecks';

/**
 * Older versions of the `_Paychecks` tab, turned into plain dated paychecks when read, so nothing
 * already entered is lost.
 *
 * - Version 1 was a schedule: a first payment date, gross pay, deductions and a repeat. Each
 *   payment the schedule made up to its end date (or today) becomes one paycheck on that date.
 * - Version 2 was one payslip per month. It becomes a paycheck on the last day of that month.
 */

const REPEATS = ['none', 'weekly', 'every2weeks', 'every4weeks', 'monthly', 'yearly'] as const;
type Repeat = (typeof REPEATS)[number];

const STEP_DAYS: Partial<Record<Repeat, number>> = { weekly: 7, every2weeks: 14, every4weeks: 28 };
const DAY_MS = 24 * 60 * 60 * 1000;
/** A repeating paycheck with no end is carried up to today, and never past this many payments. */
const MAX_PAYMENTS = 1200;

const lineSchema = z.object({
  name: z.string(),
  amount: z.number().finite().min(0),
});

const linesOf = (value: unknown): { name: string; amount: number }[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = lineSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

const legacySchema = z.object({
  name: z.string().catch(''),
  date: isoDateSchema,
  gross: z.number().finite().gt(0),
  deductions: z.unknown().transform(linesOf),
  repeat: z.enum(REPEATS).catch('none'),
  until: isoDateSchema.nullable().catch(null),
});

const toDay = (date: IsoDate) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const fromDay = (day: number): IsoDate => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** Day `day` of a month, or its last day when the month is shorter (the 31st becomes the 30th). */
function clampedDate(year: number, monthIndex: number, day: number): IsoDate {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(monthIndex + 1)}-${pad(Math.min(day, last))}`;
}

/** Every date a version 1 schedule paid on, up to its end date or `today`. */
function paymentDates(
  start: IsoDate,
  repeat: Repeat,
  until: IsoDate | null,
  today: IsoDate
): IsoDate[] {
  if (repeat === 'none') return [start];
  const end = until !== null && until >= start ? until : today;
  if (end < start) return [start];
  const dates: IsoDate[] = [];
  const step = STEP_DAYS[repeat];
  if (step !== undefined) {
    for (let day = toDay(start); day <= toDay(end) && dates.length < MAX_PAYMENTS; day += step)
      dates.push(fromDay(day));
    return dates;
  }
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7)) - 1;
  const day = Number(start.slice(8, 10));
  const stride = repeat === 'yearly' ? 12 : 1;
  for (let n = 0; dates.length < MAX_PAYMENTS; n++) {
    const index = year * 12 + month + n * stride;
    const date = clampedDate(Math.floor(index / 12), index % 12, day);
    if (date > end) break;
    dates.push(date);
  }
  return dates;
}

const lines = (list: { name: string; amount: number }[], fallback: string): PayLine[] =>
  list
    .filter((l) => l.amount > 0)
    .map((l, i) => ({ id: `l${i + 1}`, name: l.name.trim() || fallback, amount: l.amount }));

/** Dated paychecks from the stored version 1 list, one per payment made. */
export function migrateScheduledPaychecks(stored: readonly unknown[], today: IsoDate): Paycheck[] {
  if (!isIsoDate(today)) return [];
  const paychecks: Paycheck[] = [];
  for (const item of stored) {
    const parsed = legacySchema.safeParse(item);
    if (!parsed.success) continue;
    const { name, date, gross, deductions, repeat, until } = parsed.data;
    for (const paid of paymentDates(date, repeat, until, today))
      paychecks.push({
        id: '',
        date: paid,
        income: [{ id: 'l1', name: name.trim() || 'Pay', amount: gross }],
        benefits: [],
        deductions: lines(deductions, 'Deduction'),
      });
  }
  return paychecks;
}

const monthlySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  income: z.unknown().transform(linesOf),
  deductions: z.unknown().transform(linesOf),
});

/** Dated paychecks from the stored version 2 list: each month's payslip, on that month's last day. */
export function migrateMonthlyPaychecks(stored: readonly unknown[]): Paycheck[] {
  const paychecks: Paycheck[] = [];
  for (const item of stored) {
    const parsed = monthlySchema.safeParse(item);
    if (!parsed.success) continue;
    paychecks.push({
      id: '',
      date: monthEnd(parsed.data.month),
      income: lines(parsed.data.income, 'Pay'),
      benefits: [],
      deductions: lines(parsed.data.deductions, 'Deduction'),
    });
  }
  return paychecks;
}
