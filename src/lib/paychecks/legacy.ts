import { z } from 'zod';
import type { IsoDate } from '../domain/types';
import { isoDateSchema } from '../domain/schemas';
import { addMonths, monthOf, type MonthKey } from '../metrics/months';
import { isIsoDate } from '../transactions/dates';
import { round, type PayLine, type Paycheck } from './paychecks';

/**
 * Version 1 of the `_Paychecks` tab: one paycheck was a name, a first payment date, gross pay,
 * deductions, a destination account and a repeat schedule. It is turned into per-month entries when
 * read, so nothing already entered is lost. The account is dropped.
 */

const REPEATS = ['none', 'weekly', 'every2weeks', 'every4weeks', 'monthly', 'yearly'] as const;
type Repeat = (typeof REPEATS)[number];

const STEP_DAYS: Partial<Record<Repeat, number>> = { weekly: 7, every2weeks: 14, every4weeks: 28 };
const DAY_MS = 24 * 60 * 60 * 1000;
/** A repeating paycheck with no end is carried up to the current month, and never past this. */
const MAX_MONTHS = 600;

const lineSchema = z.object({
  name: z.string(),
  amount: z.number().finite().min(0),
});

const legacySchema = z.object({
  name: z.string().catch(''),
  date: isoDateSchema,
  gross: z.number().finite().gt(0),
  deductions: z.unknown().transform((value) =>
    Array.isArray(value)
      ? value.flatMap((item) => {
          const parsed = lineSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : []
  ),
  repeat: z.enum(REPEATS).catch('none'),
  until: isoDateSchema.nullable().catch(null),
});

const toDay = (date: IsoDate) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const fromDay = (day: number): IsoDate => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The month of every payment from `start` to `end`, one entry per payment. */
function paymentMonths(
  start: IsoDate,
  repeat: Repeat,
  until: IsoDate | null,
  today: IsoDate
): MonthKey[] {
  const first = monthOf(start);
  if (repeat === 'none') return [first];
  const last = until && until >= start ? monthOf(until) : monthOf(today);
  if (last < first) return [first];
  const months: MonthKey[] = [];
  const step = STEP_DAYS[repeat];
  if (step !== undefined) {
    const end = until && until >= start ? until : today;
    for (let day = toDay(start); day <= toDay(end) && months.length < MAX_MONTHS * 5; day += step)
      months.push(monthOf(fromDay(day)));
    return months.length ? months : [first];
  }
  const stride = repeat === 'yearly' ? 12 : 1;
  for (
    let month = first;
    month <= last && months.length < MAX_MONTHS;
    month = addMonths(month, stride)
  )
    months.push(month);
  return months;
}

function merge(into: PayLine[], name: string, amount: number) {
  const key = name.trim().toLowerCase();
  const found = into.find((l) => l.name.trim().toLowerCase() === key);
  if (found) found.amount = round(found.amount + amount);
  else into.push({ id: `l${into.length + 1}`, name: name.trim(), amount });
}

/**
 * Per-month paychecks from the stored version 1 list. Payments in the same month (two jobs, a
 * weekly pay) are added together, lines with the same name are merged. A repeating paycheck with
 * no end date runs up to the month of `today`.
 */
export function migrateLegacyPaychecks(paychecks: readonly unknown[], today: IsoDate): Paycheck[] {
  if (!isIsoDate(today)) return [];
  const byMonth = new Map<MonthKey, Paycheck>();
  for (const stored of paychecks) {
    const parsed = legacySchema.safeParse(stored);
    if (!parsed.success) continue;
    const { name, date, gross, deductions, repeat, until } = parsed.data;
    for (const month of paymentMonths(date, repeat, until, today)) {
      const paycheck = byMonth.get(month) ?? { month, income: [], deductions: [] };
      byMonth.set(month, paycheck);
      merge(paycheck.income, name.trim() || 'Pay', gross);
      for (const d of deductions)
        if (d.amount > 0 && d.name.trim()) merge(paycheck.deductions, d.name, d.amount);
    }
  }
  return [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}
