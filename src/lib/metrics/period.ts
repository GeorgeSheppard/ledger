import type { IsoDate } from '../domain/types';
import { DAY_MS, dayStart, isoDateOf } from './buckets';
import { addMonths, isIsoDate, monthEnd, monthOf, monthsBetween } from './months';
import { dataMonthRange, type AccountLedger } from './netWorth';

/** The one date range every dashboard graph is drawn for. Both ends are inclusive. */
export interface Period {
  from: IsoDate;
  to: IsoDate;
}

export function monthPeriod(month: string): Period {
  return { from: `${month}-01`, to: monthEnd(month) };
}

/** Whether the period is one or more whole calendar months, which is what stepping keeps intact. */
function wholeMonths(period: Period): boolean {
  return period.from.endsWith('-01') && period.to === monthEnd(monthOf(period.to));
}

export function periodDays(period: Period): number {
  return Math.round((dayStart(period.to) - dayStart(period.from)) / DAY_MS) + 1;
}

/** How many whole months the dashboard opens on, ending at the latest month with data. */
export const DEFAULT_PERIOD_MONTHS = 6;

/** The last six months up to the latest one with data (never after `today`), as whole months. */
export function defaultPeriod(ledgers: readonly AccountLedger[], today: IsoDate): Period {
  const dated = ledgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
  const last = dataMonthRange(dated, today)?.last ?? monthOf(today);
  return {
    from: `${addMonths(last, 1 - DEFAULT_PERIOD_MONTHS)}-01`,
    to: monthEnd(last),
  };
}

/**
 * The period `by` steps along: whole months move by as many months as they span, anything else
 * by its own length in days.
 */
export function shiftPeriod(period: Period, by: 1 | -1): Period {
  if (wholeMonths(period)) {
    const count = monthsBetween(monthOf(period.from), monthOf(period.to)).length;
    const first = addMonths(monthOf(period.from), by * count);
    return { from: `${first}-01`, to: monthEnd(addMonths(first, count - 1)) };
  }
  const days = periodDays(period) * by;
  return {
    from: isoDateOf(dayStart(period.from) + days * DAY_MS),
    to: isoDateOf(dayStart(period.to) + days * DAY_MS),
  };
}

/** How many periods before the viewed one are averaged for "vs average". */
export const COMPARISON_PERIODS = 6;

/**
 * The up to six periods of the same length straight before `period`, most recent first. A period
 * that starts before `first` (the first transaction) is left out, so a short history averages over
 * what exists instead of counting empty months as zero spending.
 */
export function comparisonPeriods(period: Period, first?: IsoDate): Period[] {
  const found: Period[] = [];
  let step = period;
  for (let i = 0; i < COMPARISON_PERIODS; i++) {
    step = shiftPeriod(step, -1);
    if (first && step.from < first) break;
    found.push(step);
  }
  return found;
}

export interface PeriodPreset {
  id: string;
  label: string;
  period: Period;
}

/** Quick choices. "All time" is left out when there is no data to span. */
export function periodPresets(today: IsoDate, first?: IsoDate): PeriodPreset[] {
  const month = monthOf(today);
  const lastMonth = addMonths(month, -1);
  const year = today.slice(0, 4);
  const presets: PeriodPreset[] = [
    { id: 'this-month', label: 'This month', period: monthPeriod(month) },
    { id: 'last-month', label: 'Last month', period: monthPeriod(lastMonth) },
    {
      id: 'last-3-months',
      label: 'Last 3 months',
      period: { from: `${addMonths(month, -2)}-01`, to: monthEnd(month) },
    },
    {
      id: 'last-12-months',
      label: 'Last 12 months',
      period: { from: `${addMonths(month, -11)}-01`, to: monthEnd(month) },
    },
    { id: 'this-year', label: 'This year', period: { from: `${year}-01-01`, to: `${year}-12-31` } },
  ];
  if (first) presets.push({ id: 'all', label: 'All time', period: { from: first, to: today } });
  return presets;
}

export function samePeriod(a: Period, b: Period): boolean {
  return a.from === b.from && a.to === b.to;
}

/** The first date of any transaction, or undefined without dated ones. */
export function firstDate(ledgers: readonly AccountLedger[]): IsoDate | undefined {
  let first: IsoDate | undefined;
  for (const l of ledgers)
    for (const t of l.transactions)
      if (isIsoDate(t.date) && (!first || t.date < first)) first = t.date;
  return first;
}
