import { describe, expect, it } from 'vitest';
import { makeTransactions } from './testing';
import {
  defaultPeriod,
  firstDate,
  monthPeriod,
  periodDays,
  periodPresets,
  previousPeriod,
  shiftPeriod,
} from './period';

const ledgers = [
  {
    account: { id: 1, name: 'Current' },
    transactions: makeTransactions(1, [
      ['2026-03-10', 100, 'Salary'],
      ['2026-09-20', -5, 'Bills'],
    ]),
  },
];

describe('period', () => {
  it('defaults to the latest month with data, never after today', () => {
    expect(defaultPeriod(ledgers, '2026-10-25')).toEqual(monthPeriod('2026-09'));
    expect(defaultPeriod(ledgers, '2026-05-02')).toEqual(monthPeriod('2026-05'));
    expect(defaultPeriod([], '2026-05-02')).toEqual(monthPeriod('2026-05'));
  });

  it('steps whole months by months, including across a year', () => {
    expect(shiftPeriod(monthPeriod('2026-01'), -1)).toEqual(monthPeriod('2025-12'));
    expect(shiftPeriod({ from: '2026-01-01', to: '2026-03-31' }, 1)).toEqual({
      from: '2026-04-01',
      to: '2026-06-30',
    });
  });

  it('steps other ranges by their length', () => {
    const range = { from: '2026-03-05', to: '2026-03-11' };
    expect(periodDays(range)).toBe(7);
    expect(previousPeriod(range)).toEqual({ from: '2026-02-26', to: '2026-03-04' });
  });

  it('offers presets, and all time when there is data', () => {
    expect(periodPresets('2026-10-25').map((p) => p.id)).not.toContain('all');
    const all = periodPresets('2026-10-25', firstDate(ledgers)).at(-1)!;
    expect(all.period).toEqual({ from: '2026-03-10', to: '2026-10-25' });
  });
});
