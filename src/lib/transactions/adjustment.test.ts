import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/types';
import { findTransfers } from '../metrics/transfers';
import {
  BALANCE_ADJUSTMENT_NOTE,
  balanceOn,
  isBalanceAdjustment,
  planBalanceAdjustment,
} from './adjustment';

const rows = [
  { date: '2026-01-01', amount: 1000 },
  { date: '2026-02-01', amount: -200 },
  { date: '2026-03-01', amount: 50 },
];

describe('balanceOn', () => {
  it('sums rows up to and including the date', () => {
    expect(balanceOn({ inverted: false }, rows, '2026-02-01')).toBe(800);
    expect(balanceOn({ inverted: false }, rows, '2025-12-31')).toBe(0);
  });
  it('flips an inverted account into money terms', () => {
    expect(balanceOn({ inverted: true }, rows, '2026-03-01')).toBe(-850);
  });
});

describe('planBalanceAdjustment', () => {
  it('adds the difference as a plain labelled row', () => {
    const plan = planBalanceAdjustment({ inverted: false }, rows, '2026-03-01', 900.1);
    expect(plan?.difference).toBe(50.1);
    expect(plan?.input).toEqual({
      date: '2026-03-01',
      category: '',
      amount: 50.1,
      note: BALANCE_ADJUSTMENT_NOTE,
    });
  });
  it('can be negative', () => {
    expect(planBalanceAdjustment({ inverted: false }, rows, '2026-03-01', 800)?.input.amount).toBe(
      -50
    );
  });
  it('uses the balance on the chosen date, not today', () => {
    expect(planBalanceAdjustment({ inverted: false }, rows, '2026-01-15', 1010)?.difference).toBe(
      10
    );
  });
  it('returns null when the balance already matches', () => {
    expect(planBalanceAdjustment({ inverted: false }, rows, '2026-03-01', 850)).toBeNull();
  });
  it('writes the sheet-side sign for an inverted account', () => {
    // Owes 850; the bank says 900 owed, so money balance -900: difference -50, tab amount +50.
    const plan = planBalanceAdjustment({ inverted: true }, rows, '2026-03-01', -900);
    expect(plan?.difference).toBe(-50);
    expect(plan?.input.amount).toBe(50);
  });
});

describe('adjustment rows', () => {
  const tx = (id: string, accountId: number, amount: number, note: string): Transaction => ({
    id,
    accountId,
    row: 3,
    date: '2026-03-01',
    category: '',
    amount,
    note,
    total: 0,
  });
  it('is recognised by its note', () => {
    expect(isBalanceAdjustment(tx('a', 1, 5, BALANCE_ADJUSTMENT_NOTE))).toBe(true);
    expect(isBalanceAdjustment(tx('a', 1, 5, 'Coffee'))).toBe(false);
  });
  it('is never paired as a transfer', () => {
    const paired = findTransfers([
      tx('a', 1, 5, BALANCE_ADJUSTMENT_NOTE),
      tx('b', 2, -5, 'Coffee'),
    ]);
    expect(paired.size).toBe(0);
  });
});
