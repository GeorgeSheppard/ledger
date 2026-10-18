import { describe, expect, it } from 'vitest';
import { makeTransactions } from './testing';
import { excludedFromCashFlow, findTransfers } from './transfers';

describe('findTransfers', () => {
  it('pairs equal and opposite amounts in different accounts within a few days', () => {
    const current = makeTransactions(1, [
      ['2026-04-26', -500, 'Savings'],
      ['2026-04-27', -42, 'Transport'],
    ]);
    const savings = makeTransactions(2, [['2026-04-28', 500, 'Savings']]);
    expect(findTransfers([...current, ...savings])).toEqual(new Set(['1:2', '2:2']));
  });

  it('ignores matches in the same account or too far apart', () => {
    const current = makeTransactions(1, [
      ['2026-04-01', -50],
      ['2026-04-02', 50],
    ]);
    const other = makeTransactions(2, [['2026-04-20', 50]]);
    expect(findTransfers([...current, ...other]).size).toBe(0);
  });

  it('uses each incoming transaction once, closest date first', () => {
    const out = makeTransactions(1, [
      ['2026-04-10', -100],
      ['2026-04-11', -100],
    ]);
    const into = makeTransactions(2, [['2026-04-11', 100]]);
    expect(findTransfers([...out, ...into])).toEqual(new Set(['1:2', '2:2']));
  });

  it('matches amounts with float noise', () => {
    const out = makeTransactions(1, [['2026-04-10', -0.1 - 0.2]]);
    const into = makeTransactions(2, [['2026-04-10', 0.3]]);
    expect(findTransfers([...out, ...into]).size).toBe(2);
  });
});

describe('excludedFromCashFlow', () => {
  it('also excludes uncategorised opening balances on the first row', () => {
    const rows = makeTransactions(1, [
      ['2026-04-01', 1000, '', 'Opening balance'],
      ['2026-04-02', 1000, '', 'Opening balance'],
      ['2026-04-03', 20, 'Salary', 'Opening balance'],
    ]);
    expect(excludedFromCashFlow(rows)).toEqual(new Set(['1:2']));
  });
});
