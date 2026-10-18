import { describe, expect, it } from 'vitest';
import { balanceByMonth, dataMonthRange, netWorthByMonth } from './netWorth';
import { makeTransactions } from './testing';

const current = makeTransactions(1, [
  ['2026-04-01', 1000],
  ['2026-05-20', -200.1],
  ['2026-04-15', -100], // out of date order on purpose
]);
const savings = makeTransactions(2, [['2026-05-31', 500]]);
const ledgers = [
  { account: { id: 1, name: 'Current' }, transactions: current },
  { account: { id: 2, name: 'Savings' }, transactions: savings },
];

describe('balanceByMonth', () => {
  it('sums amounts by date up to each month end', () => {
    expect(balanceByMonth(current, ['2026-03', '2026-04', '2026-05', '2026-06'])).toEqual([
      0, 900, 699.9, 699.9,
    ]);
  });
});

describe('netWorthByMonth', () => {
  it('adds up every account', () => {
    expect(netWorthByMonth(ledgers, ['2026-04', '2026-05'])).toEqual([
      { month: '2026-04', total: 900, byAccount: { 1: 900, 2: 0 } },
      { month: '2026-05', total: 1199.9, byAccount: { 1: 699.9, 2: 500 } },
    ]);
  });
});

describe('dataMonthRange', () => {
  it('spans the earliest to latest transaction', () => {
    expect(dataMonthRange(ledgers)).toEqual({ first: '2026-04', last: '2026-05' });
  });

  it('is null without transactions', () => {
    expect(dataMonthRange([{ account: { id: 1, name: 'A' }, transactions: [] }])).toBeNull();
  });
});
