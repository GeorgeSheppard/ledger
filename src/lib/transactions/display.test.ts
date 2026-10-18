import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/types';
import { displayOrder, groupByMonth, selectionAfterDelete, summarizeAccount } from './display';

function tx(row: number, date: string, amount: number, total: number): Transaction {
  return { id: `1:${row}`, accountId: 1, row, date, category: '', amount, note: '', total };
}

const rows = [
  tx(2, '2026-09-01', 1000, 1000),
  tx(3, '2026-09-15', -200, 800),
  tx(4, '2026-10-01', -50.5, 749.5),
  tx(5, '2026-10-02', 100, 849.5),
];

describe('display helpers', () => {
  it('shows the newest row first', () => {
    expect(displayOrder(rows).map((t) => t.row)).toEqual([5, 4, 3, 2]);
  });

  it('groups consecutive rows by month with in and out totals', () => {
    const groups = groupByMonth(displayOrder(rows));
    expect(groups.map((g) => [g.key, g.transactions.length, g.moneyIn, g.moneyOut])).toEqual([
      ['2026-10', 2, 100, -50.5],
      ['2026-09', 2, 1000, -200],
    ]);
  });

  it('summarises balance and the current month', () => {
    expect(summarizeAccount(rows, '2026-10-17')).toEqual({
      balance: 849.5,
      monthIn: 100,
      monthOut: -50.5,
      count: 4,
    });
    expect(summarizeAccount([], '2026-10-17').balance).toBe(0);
  });

  it('picks the row to select after a delete', () => {
    expect(selectionAfterDelete(rows, rows[2]!)).toBe('1:3');
    expect(selectionAfterDelete(rows, rows[0]!)).toBe('1:2');
    expect(selectionAfterDelete([rows[0]!], rows[0]!)).toBeNull();
  });
});
