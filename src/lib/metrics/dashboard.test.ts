import { describe, expect, it } from 'vitest';
import { fixtureData } from '../data/fixtures';
import { toSnapshot } from '../store/ledgerData';
import { categoryBreakdown, periodCashFlow } from './dashboard';
import { monthPeriod } from './period';
import { makeTransactions } from './testing';

const ledgers = [
  {
    account: { id: 1, name: 'Current' },
    transactions: makeTransactions(1, [
      ['2026-01-01', 1000, '', 'Opening balance'],
      ['2026-01-25', 2000, 'Salary'],
      ['2026-01-26', -300, 'Rent'],
      ['2026-02-25', 2000, 'Salary'],
      ['2026-02-26', -300, 'Rent'],
      ['2026-02-27', -100, 'Groceries'],
      ['2026-03-25', 2000, 'Salary'],
      ['2026-03-26', -400, 'Rent'],
      ['2026-03-27', -500, 'Savings'],
    ]),
  },
  {
    account: { id: 2, name: 'Savings' },
    transactions: makeTransactions(2, [['2026-03-27', 500, 'Savings']]),
  },
];
const march = monthPeriod('2026-03');

describe('periodCashFlow', () => {
  it('leaves out transfers and opening balances', () => {
    const flow = periodCashFlow(ledgers, [1, 2], monthPeriod('2026-01'));
    expect(flow.income).toBe(2000);
    expect(flow.spending).toBe(300);
  });

  it('limits to the chosen accounts but still matches transfers across all of them', () => {
    // The 500 moved to Savings is a transfer, not spending, even with Savings left out.
    expect(periodCashFlow(ledgers, [1], march).spending).toBe(400);
    expect(periodCashFlow(ledgers, [], march).spending).toBe(0);
  });

  it('counts any range of days, not just months', () => {
    const flow = periodCashFlow(ledgers, [1], { from: '2026-02-26', to: '2026-03-26' });
    expect(flow.spending).toBe(300 + 100 + 400);
    expect(flow.income).toBe(2000);
  });

  it('leaves excluded categories out of spending', () => {
    expect(periodCashFlow(ledgers, [1], march, new Set(['rent'])).spending).toBe(0);
  });

  it('ignores rows without a readable date', () => {
    const withSummaryTab = [
      ...ledgers,
      { account: { id: 3, name: 'Summary' }, transactions: makeTransactions(3, [['', -500]]) },
    ];
    expect(periodCashFlow(withSummaryTab, [1, 2, 3], march).spending).toBe(400);
  });
});

describe('categoryBreakdown', () => {
  it('compares with the average of the periods of the same length before', () => {
    // January had only Rent (300), so February averages over one month.
    expect(categoryBreakdown(ledgers, [1], monthPeriod('2026-02'))).toEqual([
      { category: 'Rent', amount: 300, average: 300 },
      { category: 'Groceries', amount: 100, average: 0 },
    ]);
  });

  it('averages only the months that exist and keeps categories that only had spending before', () => {
    // January 300, February 300 + 100 groceries; the months before the data are not counted.
    expect(categoryBreakdown(ledgers, [1], march)).toEqual([
      { category: 'Rent', amount: 400, average: 300 },
      { category: 'Groceries', amount: 0, average: 50 },
    ]);
  });

  it('has no average for the first month of data', () => {
    expect(categoryBreakdown(ledgers, [1], monthPeriod('2026-01'))).toEqual([
      { category: 'Rent', amount: 300, average: 0 },
    ]);
  });

  it('works on the demo data', () => {
    const snapshot = toSnapshot(fixtureData(), []);
    const loaded = snapshot.accounts.map((account) => ({
      account,
      transactions: snapshot.transactionsByAccount[account.id] ?? [],
    }));
    const latest = loaded
      .flatMap((l) => l.transactions.map((t) => t.date))
      .sort()
      .at(-1)!;
    const rows = categoryBreakdown(
      loaded,
      loaded.map((l) => l.account.id),
      monthPeriod(latest.slice(0, 7))
    );
    // Transfers to savings are not spending.
    expect(rows.map((r) => r.category)).not.toContain('Savings');
    expect(rows.length).toBeGreaterThan(0);
  });
});
