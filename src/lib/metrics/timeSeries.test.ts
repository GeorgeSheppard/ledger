import { describe, expect, it } from 'vitest';
import { buildTimeSeries } from './timeSeries';
import { makeTransactions } from './testing';

const april2May = { from: '2026-04-01', to: '2026-05-31' };
const ledgers = [
  {
    account: { id: 1, name: 'Current' },
    transactions: makeTransactions(1, [
      ['2026-04-01', 1000, 'Salary'],
      ['2026-04-08', -40, 'Groceries'],
      ['2026-04-09', -10, 'Groceries'],
      ['2026-04-20', -5, 'Bills'],
      ['2026-05-02', -7, 'Bills'],
    ]),
  },
];

describe('buildTimeSeries', () => {
  const series = buildTimeSeries(ledgers, [1], april2May);

  it('covers whole months', () => {
    expect(new Date(series.startMs).toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(new Date(series.endMs).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('adds up to the same totals at every level of detail', () => {
    const total = (g: 'month' | 'week' | 'day') =>
      series.cashFlow(g).reduce((sum, f) => sum + f.spending, 0);
    expect(total('month')).toBe(62);
    expect(total('week')).toBe(62);
    expect(total('day')).toBe(62);
  });

  it('puts a week of spending together and reports the balance at its end', () => {
    const buckets = series.buckets('week');
    const index = buckets.findIndex((b) => b.key === '2026-04-06');
    expect(series.cashFlow('week')[index]!.spending).toBe(50);
    expect(series.netWorth('week')[index]!.total).toBe(950);
  });

  it('leaves out accounts that were not asked for', () => {
    const none = buildTimeSeries(ledgers, [], april2May);
    expect(none.netWorth('month').map((p) => p.total)).toEqual([0, 0]);
  });
  it('only counts transactions inside the period, and balances as of its end', () => {
    const part = buildTimeSeries(ledgers, [1], { from: '2026-04-09', to: '2026-04-25' });
    expect(part.cashFlow('month')[0]!.spending).toBe(15);
    expect(part.netWorth('month')[0]!.total).toBe(945);
  });

  it('narrows income and spending to the chosen categories', () => {
    const groceries = buildTimeSeries(ledgers, [1], april2May, undefined, ['Groceries']);
    expect(groceries.cashFlow('month').map((f) => [f.income, f.spending])).toEqual([
      [0, 50],
      [0, 0],
    ]);
    expect(groceries.netWorth('month')[0]!.total).toBe(945);
  });
});
