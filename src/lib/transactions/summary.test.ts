import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../domain/types';
import { excludedFromCashFlow } from '../metrics/transfers';
import { cashFlowTotals } from './summary';

const account = (id: number, inverted = false): Account => ({ id, name: `Acc ${id}`, inverted });
const accounts = [account(1), account(2, true)];

function tx(
  accountId: number,
  row: number,
  date: string,
  amount: number,
  category = ''
): Transaction {
  return { id: `${accountId}:${row}`, accountId, row, date, category, amount, note: '', total: 0 };
}

describe('cashFlowTotals', () => {
  it('sums money in and out', () => {
    const rows = [tx(1, 3, '2026-09-01', 2000, 'Salary'), tx(1, 4, '2026-09-02', -45.5, 'Food')];
    expect(cashFlowTotals(rows, accounts)).toEqual({
      count: 2,
      moneyIn: 2000,
      moneyOut: -45.5,
      leftOut: 0,
    });
  });

  it('leaves out transfers between accounts', () => {
    const rows = [
      tx(1, 3, '2026-09-01', 2000, 'Salary'),
      tx(1, 4, '2026-09-02', -500),
      tx(2, 3, '2026-09-02', -500), // card payment, recorded from the card's side
    ];
    const excluded = excludedFromCashFlow(
      rows.map((t) => (t.accountId === 2 ? { ...t, amount: -t.amount } : t))
    );
    expect(cashFlowTotals(rows, accounts, excluded)).toMatchObject({
      moneyIn: 2000,
      moneyOut: 0,
      leftOut: 2,
    });
  });

  it('leaves out ignored categories', () => {
    const rows = [tx(1, 3, '2026-09-01', 900, 'Savings'), tx(1, 4, '2026-09-02', -10, 'Food')];
    const excluded = excludedFromCashFlow(rows, new Set(['savings']));
    expect(cashFlowTotals(rows, accounts, excluded)).toMatchObject({
      moneyIn: 0,
      moneyOut: -10,
      leftOut: 1,
    });
  });

  it('flips an inverted account so a card purchase is money out', () => {
    const rows = [tx(2, 3, '2026-09-01', 80), tx(2, 4, '2026-09-05', -80)];
    expect(cashFlowTotals(rows, accounts)).toMatchObject({ moneyIn: 80, moneyOut: -80 });
    expect(cashFlowTotals([rows[0]!], accounts)).toMatchObject({ moneyIn: 0, moneyOut: -80 });
  });
});
