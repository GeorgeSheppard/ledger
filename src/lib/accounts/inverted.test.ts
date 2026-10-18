import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../domain/types';
import { buildDashboard } from '../metrics/dashboard';
import { findTransfers } from '../metrics/transfers';
import { toTransactions } from '../store/ledgerData';
import { asMoney, moneyLedgers } from './inverted';

const bank: Account = { id: 1, name: 'Current' };
const card: Account = { id: 2, name: 'Visa', inverted: true };

const bankTx = toTransactions(1, [
  { date: '2026-01-01', category: 'Salary', amount: 1000, note: '' },
  { date: '2026-02-10', category: '', amount: -200, note: 'Visa payment' },
]);
// Purchases are positive on a card; the payment brings the balance owed down.
const cardTx = toTransactions(2, [
  { date: '2026-01-15', category: 'Food', amount: 200, note: 'Shop' },
  { date: '2026-02-10', category: '', amount: -200, note: 'Payment' },
  { date: '2026-02-20', category: 'Food', amount: 50, note: 'Shop' },
]);

describe('asMoney', () => {
  it('flips amounts and running totals of an inverted account', () => {
    const flipped = asMoney(card, cardTx);
    expect(flipped.map((t) => t.amount)).toEqual([-200, 200, -50]);
    expect(flipped.map((t) => t.total)).toEqual([-200, 0, -50]);
  });

  it('returns the same array for a normal account, and caches for an inverted one', () => {
    expect(asMoney(bank, bankTx)).toBe(bankTx);
    expect(asMoney(card, cardTx)).toBe(asMoney(card, cardTx));
  });

  it('does not produce negative zero', () => {
    const [t] = asMoney(
      card,
      toTransactions(2, [{ date: '2026-01-01', category: '', amount: 0, note: '' }])
    );
    expect(Object.is(t!.amount, -0)).toBe(false);
  });
});

describe('with an inverted account', () => {
  const byAccount: Record<number, Transaction[]> = { 1: bankTx, 2: cardTx };

  it('counts the balance owed against net worth', () => {
    const d = buildDashboard(moneyLedgers([bank, card], byAccount), 'all')!;
    const feb = d.netWorth.at(-1)!;
    expect(feb.byAccount).toEqual({ 1: 800, 2: -50 });
    expect(feb.total).toBe(750);
  });

  it('counts purchases as spending and does not count the card payment as spending', () => {
    const d = buildDashboard(moneyLedgers([bank, card], byAccount), 'all')!;
    expect(d.cashFlow.map((m) => m.spending)).toEqual([200, 50]);
    expect(d.cashFlow.map((m) => m.income)).toEqual([1000, 0]);
  });

  it('pairs the payment with the bank withdrawal as a transfer', () => {
    const ledgers = moneyLedgers([bank, card], byAccount);
    const paired = findTransfers(ledgers.flatMap((l) => l.transactions));
    expect(paired).toEqual(new Set(['1:3', '2:3']));
  });
});
