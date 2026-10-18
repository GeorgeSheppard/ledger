import { describe, expect, it } from 'vitest';
import { monthlyCashFlow, spendingCategories, UNCATEGORISED } from './cashFlow';
import { makeTransactions } from './testing';

const rows = makeTransactions(1, [
  ['2026-04-01', 2000, 'Salary'],
  ['2026-04-03', -60, 'Groceries'],
  ['2026-04-09', 15, 'Groceries'], // refund
  ['2026-04-10', -30, ''],
  ['2026-05-02', -80, 'Groceries'],
  ['2026-05-05', -500, 'Rent'],
  ['2026-06-01', -1, 'Ignored'],
]);

describe('monthlyCashFlow', () => {
  it('nets each category before splitting into income and spending', () => {
    const [april, may] = monthlyCashFlow(rows, ['2026-04', '2026-05']);
    expect(april).toEqual({
      month: '2026-04',
      income: 2000,
      spending: 75,
      net: 1925,
      spendingByCategory: { Groceries: 45, [UNCATEGORISED]: 30 },
      incomeByCategory: { Salary: 2000 },
    });
    expect(may!.spending).toBe(580);
    expect(may!.income).toBe(0);
  });

  it('skips excluded transactions and months outside the list', () => {
    const [april] = monthlyCashFlow(rows, ['2026-04'], new Set(['1:2']));
    expect(april!.income).toBe(0);
  });

  it('returns zeroed months when there is no data', () => {
    expect(monthlyCashFlow([], ['2026-01'])[0]).toMatchObject({ income: 0, spending: 0, net: 0 });
  });
});

describe('spendingCategories', () => {
  it('orders categories by total spend', () => {
    const flows = monthlyCashFlow(rows, ['2026-04', '2026-05']);
    expect(spendingCategories(flows)).toEqual(['Rent', 'Groceries', UNCATEGORISED]);
  });
});
