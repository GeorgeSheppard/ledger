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

/** The latest month with data (never one after `today`), as a whole-month period. */
export function defaultPeriod(ledgers: readonly AccountLedger[], today: IsoDate): Period {
  const dated = ledgers.map((l) => ({
    account: l.account,
    transactions: l.transactions.filter((t) => isIsoDate(t.date)),
  }));
  return monthPeriod(dataMonthRange(dated, today)?.last ?? monthOf(today));
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

/** The period of the same length straight before, for "vs previous". */
export function previousPeriod(period: Period): Period {
  return shiftPeriod(period, -1);
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

/**
 * Everything worth showing around `period`: from the first transaction to the later of the
 * period's end and the last transaction (not counting any dated after `today`). The balances graph
 * draws this, with the period marked on it, so a new period can be picked by dragging across it.
 */
export function surroundingPeriod(
  ledgers: readonly AccountLedger[],
  period: Period,
  today: IsoDate
): Period {
  let last: IsoDate | undefined;
  for (const l of ledgers)
    for (const t of l.transactions)
      if (isIsoDate(t.date) && t.date <= today && (!last || t.date > last)) last = t.date;
  const first = firstDate(ledgers);
  return {
    from: first && first < period.from ? first : period.from,
    to: last && last > period.to ? last : period.to,
  };
}
