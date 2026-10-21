import { describe, expect, it } from 'vitest';
import { buildDashboard } from '../../../lib/metrics/dashboard';
import { makeTransactions } from '../../../lib/metrics/testing';
import { seriesFor } from './useTimeSeries';

const ledgers = [
  {
    account: { id: 1, name: 'Current' },
    transactions: makeTransactions(1, [
      ['2024-01-10', 1000, 'Salary'],
      ['2025-06-05', -40, 'Groceries'],
      ['2026-04-02', -10, 'Groceries'],
      ['2026-09-20', -5, 'Bills'],
    ]),
  },
];
const today = '2026-10-01';

describe('seriesFor', () => {
  it('lets a 6 month range pan back to the first transaction', () => {
    const dashboard = buildDashboard(ledgers, 6, [1], new Set(), today)!;
    const series = seriesFor(ledgers, [1], dashboard.months[0]!, new Set(), today)!;
    expect(new Date(series.startMs).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(new Date(series.endMs).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(new Date(series.windowStartMs).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('starts at the beginning of the data for "all"', () => {
    const dashboard = buildDashboard(ledgers, 'all', [1], new Set(), today)!;
    const series = seriesFor(ledgers, [1], dashboard.months[0]!, new Set(), today)!;
    expect(series.windowStartMs).toBe(series.startMs);
  });

  it('is null without data', () => {
    expect(seriesFor(ledgers, [2], '2026-04', new Set(), today)).toBeNull();
  });
});
