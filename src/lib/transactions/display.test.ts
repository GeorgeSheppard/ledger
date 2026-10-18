import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/types';
import {
  displayOrder,
  flattenGroups,
  groupByMonth,
  selectionAfterDelete,
  summarizeAccount,
} from './display';

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

  it('shows the newest date first when the sheet keeps newest rows at the top', () => {
    const newestOnTop = [
      tx(2, '2026-10-02', 100, 0),
      tx(3, '2026-10-01', -50.5, 0),
      tx(4, '2026-10-01', -10, 0),
      tx(5, '2026-09-01', 1000, 0),
    ];
    expect(displayOrder(newestOnTop).map((t) => t.row)).toEqual([2, 4, 3, 5]);
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
      lastDate: '2026-10-02',
    });
    expect(summarizeAccount([], '2026-10-17')).toMatchObject({ balance: 0, lastDate: null });
  });

  it('picks the row to select after a delete', () => {
    // Shown 5, 4, 3, 2: deleting 4 selects the older row 3, whose id is unchanged.
    expect(selectionAfterDelete(rows, rows[2]!)).toBe('1:3');
    // Deleting the oldest (row 2) selects the one above it, row 3, which moves up to row 2.
    expect(selectionAfterDelete(rows, rows[0]!)).toBe('1:2');
    expect(selectionAfterDelete([rows[0]!], rows[0]!)).toBeNull();
    // Newest at the top of the sheet: deleting row 2 selects row 3, which moves up to row 2.
    const newestOnTop = [tx(2, '2026-10-02', 1, 0), tx(3, '2026-10-01', 1, 0)];
    expect(selectionAfterDelete(newestOnTop, newestOnTop[0]!)).toBe('1:2');
  });
});

describe('flattenGroups', () => {
  it('puts a month heading before each month’s rows', () => {
    const items = flattenGroups(
      groupByMonth([
        tx(3, '2026-09-02', 5, 0),
        tx(2, '2026-08-20', -2, 0),
        tx(1, '2026-08-01', -3, 0),
      ])
    );
    expect(items.map((i) => (i.kind === 'month' ? i.key : i.transaction.row))).toEqual([
      '2026-09',
      3,
      '2026-08',
      2,
      1,
    ]);
  });

  it('copes with a very large account', () => {
    const many = Array.from({ length: 100_000 }, (_, i) =>
      tx(100_000 - i, `20${10 + (i % 15)}-0${1 + (i % 9)}-15`, -1, 0)
    );
    const started = performance.now();
    const items = flattenGroups(groupByMonth(many));
    expect(items.length).toBeGreaterThan(100_000);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
