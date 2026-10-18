import { describe, expect, it } from 'vitest';
import { fixtureData } from '../data/fixtures';
import { toSnapshot } from '../store/ledgerData';
import { buildDashboard, categoryBreakdown } from './dashboard';
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

describe('buildDashboard', () => {
  it('is null with no transactions', () => {
    expect(buildDashboard([], 6)).toBeNull();
  });

  it('ignores rows without a readable date instead of showing nothing', () => {
    const withSummaryTab = [
      ...ledgers,
      {
        account: { id: 3, name: 'Summary' },
        transactions: makeTransactions(3, [['', 500]]),
      },
    ];
    const dashboard = buildDashboard(withSummaryTab, 'all')!;
    expect(dashboard.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(dashboard.latest.netWorth).toBe(buildDashboard(ledgers, 'all')!.latest.netWorth);
  });

  it('limits to the chosen accounts but still matches transfers across all of them', () => {
    const current = buildDashboard(ledgers, 3, [1])!;
    expect(current.accounts.map((a) => a.account.id)).toEqual([1]);
    expect(current.latest.netWorth).toBe(5400);
    // The 500 moved to Savings is a transfer, not spending, even with Savings left out.
    expect(current.latest.spending).toBe(400);
    expect(buildDashboard(ledgers, 3, [])).toBeNull();
  });

  it('ends at the latest month with data and clips to the first', () => {
    expect(buildDashboard(ledgers, 12)!.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(buildDashboard(ledgers, 'all')!.months).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(buildDashboard(ledgers, 2)!.months).toEqual(['2026-02', '2026-03']);
  });

  it('summarises the latest month, leaving out transfers and opening balances', () => {
    const { latest, accounts } = buildDashboard(ledgers, 3)!;
    expect(latest).toEqual({
      month: '2026-03',
      netWorth: 5900,
      netWorthChange: 1600,
      income: 2000,
      spending: 400,
      previousSpending: 400,
      savingsRate: 0.8,
      averageSpending: 366.67,
    });
    expect(accounts.map((a) => [a.account.name, a.balance, a.change])).toEqual([
      ['Current', 5400, 1100],
      ['Savings', 500, 500],
    ]);
  });

  it('leaves excluded categories out of spending but keeps balances and net worth', () => {
    const all = buildDashboard(ledgers, 3)!;
    const ignored = buildDashboard(ledgers, 3, undefined, new Set(['rent']))!;
    expect(all.latest.spending).toBe(400);
    expect(ignored.latest.spending).toBe(0);
    expect(ignored.categories).not.toContain('Rent');
    expect(ignored.latest.netWorth).toBe(all.latest.netWorth);
    expect(ignored.accounts.map((a) => a.balance)).toEqual(all.accounts.map((a) => a.balance));
  });

  it('compares the first month in range with the month before it', () => {
    const dashboard = buildDashboard(ledgers, 2)!;
    expect(dashboard.previousCashFlow?.month).toBe('2026-01');
    expect(categoryBreakdown(dashboard, '2026-02')).toEqual([
      { category: 'Rent', amount: 300, previous: 300, average: 350 },
      { category: 'Groceries', amount: 100, previous: 0, average: 50 },
    ]);
  });

  it('has no previous spending when the data starts in the latest month', () => {
    const single = [ledgers[1]!];
    expect(buildDashboard(single, 6)!.latest.previousSpending).toBeNull();
  });

  it('works on the demo data', () => {
    const snapshot = toSnapshot(fixtureData(), []);
    const loaded = snapshot.accounts.map((account) => ({
      account,
      transactions: snapshot.transactionsByAccount[account.id] ?? [],
    }));
    const dashboard = buildDashboard(loaded, 6)!;
    expect(dashboard.months).toHaveLength(6);
    // Transfers to savings are not spending.
    expect(dashboard.categories).not.toContain('Savings');
    expect(dashboard.latest.income).toBe(2850);
  });
});
