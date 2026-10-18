import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/types';
import { displayOrder } from './display';
import {
  categoriesInUse,
  countFilters,
  defaultSort,
  filterTransactions,
  hasFilters,
  nextSort,
  noFilters,
  sortTransactions,
  totalsOf,
  type SortKey,
  type TransactionFilters,
} from './filters';
import { transactionKey } from './duplicates';

function tx(row: number, date: string, amount: number, category = '', note = ''): Transaction {
  return { id: `1:${row}`, accountId: 1, row, date, category, amount, note, total: row * 100 };
}

const rows = [
  tx(2, '2026-09-01', 2000, 'Salary', 'September pay'),
  tx(3, '2026-09-15', -45.5, 'Food', 'Tesco shop'),
  tx(4, '2026-09-15', -45.5, 'Food', 'tesco  SHOP'),
  tx(5, '2026-10-01', -12, 'Transport', 'Train'),
  tx(6, '2026-10-02', 12, '', 'Refund'),
];

const by = (patch: Partial<TransactionFilters>) =>
  filterTransactions(rows, { ...noFilters, ...patch }).map((t) => t.row);

describe('filterTransactions', () => {
  it('keeps everything with no filters', () => {
    expect(by({})).toEqual([2, 3, 4, 5, 6]);
    expect(hasFilters(noFilters)).toBe(false);
  });

  it('keeps only the chosen accounts', () => {
    const mixed = rows.map((t, i) => ({ ...t, accountId: i % 2 }));
    const ids = (accounts: number[]) =>
      filterTransactions(mixed, { ...noFilters, accounts }).map((t) => t.row);
    expect(ids([])).toEqual([2, 3, 4, 5, 6]);
    expect(ids([1])).toEqual([3, 5]);
    expect(hasFilters({ ...noFilters, accounts: [1] })).toBe(true);
  });

  it('searches note and category, every word, ignoring case', () => {
    expect(by({ search: 'tesco' })).toEqual([3, 4]);
    expect(by({ search: 'food shop' })).toEqual([3, 4]);
    expect(by({ search: 'food train' })).toEqual([]);
  });

  it('filters by category, including no category', () => {
    expect(by({ categories: ['Food', 'Transport'] })).toEqual([3, 4, 5]);
    expect(by({ categories: [''] })).toEqual([6]);
  });

  it('filters by an inclusive date range, either end optional', () => {
    expect(by({ from: '2026-09-15', to: '2026-10-01' })).toEqual([3, 4, 5]);
    expect(by({ from: '2026-10-01' })).toEqual([5, 6]);
    expect(by({ to: '2026-09-01' })).toEqual([2]);
  });

  it('filters money in and out', () => {
    expect(by({ sign: 'in' })).toEqual([2, 6]);
    expect(by({ sign: 'out' })).toEqual([3, 4, 5]);
  });

  it('filters by size without the sign, and by exact amount', () => {
    expect(by({ min: 20 })).toEqual([2, 3, 4]);
    expect(by({ max: 12 })).toEqual([5, 6]);
    expect(by({ min: 12, max: 12 })).toEqual([5, 6]);
    expect(by({ exact: 45.5 })).toEqual([3, 4]);
    expect(by({ exact: 12, sign: 'out' })).toEqual([5]);
    expect(by({ exact: 45.5, min: 1000 })).toEqual([3, 4]);
  });

  it('finds duplicates, all of them or twins of one transaction', () => {
    expect(by({ duplicatesOnly: true })).toEqual([3, 4]);
    expect(by({ twinsOf: transactionKey(rows[1]!) })).toEqual([3, 4]);
    expect(by({ twinsOf: transactionKey(rows[3]!) })).toEqual([5]);
  });

  it('combines filters', () => {
    expect(by({ search: 'tesco', sign: 'out', min: 50 })).toEqual([]);
    expect(by({ search: 'tesco', sign: 'out', min: 40 })).toEqual([3, 4]);
  });

  it('counts the switched-on filters', () => {
    expect(countFilters({ ...noFilters, search: ' ', from: '2026-01-01', to: '2026-02-01' })).toBe(
      1
    );
    expect(countFilters({ ...noFilters, search: 'a', sign: 'in', min: 1, max: 2 })).toBe(3);
  });
});

describe('sortTransactions', () => {
  it('matches the default newest-first order', () => {
    expect(sortTransactions(rows, defaultSort).map((t) => t.row)).toEqual(
      displayOrder(rows).map((t) => t.row)
    );
  });

  it('sorts by amount, category and note in both directions', () => {
    expect(sortTransactions(rows, { key: 'amount', direction: 'asc' }).map((t) => t.row)).toEqual([
      3, 4, 5, 6, 2,
    ]);
    expect(sortTransactions(rows, { key: 'amount', direction: 'desc' })[0]!.row).toBe(2);
    expect(
      sortTransactions(rows, { key: 'category', direction: 'asc' }).map((t) => t.category)
    ).toEqual(['', 'Food', 'Food', 'Salary', 'Transport']);
    expect(sortTransactions(rows, { key: 'note', direction: 'asc' })[0]!.note).toBe('Refund');
    expect(sortTransactions(rows, { key: 'total', direction: 'desc' })[0]!.row).toBe(6);
  });

  it('does not change its input', () => {
    const copy = [...rows];
    sortTransactions(rows, { key: 'amount', direction: 'asc' });
    expect(rows).toEqual(copy);
  });

  it('nextSort cycles unsorted, first direction, opposite direction, unsorted', () => {
    const cycle = (key: SortKey) => {
      const steps = [];
      let sort = nextSort(null, key);
      for (let i = 0; i < 3; i++, sort = nextSort(sort, key)) steps.push(sort);
      return steps;
    };
    expect(cycle('note')).toEqual([
      { key: 'note', direction: 'asc' },
      { key: 'note', direction: 'desc' },
      null,
    ]);
    expect(cycle('amount')).toEqual([
      { key: 'amount', direction: 'desc' },
      { key: 'amount', direction: 'asc' },
      null,
    ]);
    expect(cycle('date')[0]).toEqual({ key: 'date', direction: 'asc' });
  });

  it('nextSort starts a different column from scratch', () => {
    expect(nextSort({ key: 'note', direction: 'desc' }, 'amount')).toEqual({
      key: 'amount',
      direction: 'desc',
    });
  });
});

describe('summaries', () => {
  it('totals money in and out', () => {
    expect(totalsOf(rows)).toEqual({ count: 5, moneyIn: 2012, moneyOut: -103 });
  });

  it('lists categories most used first', () => {
    expect(categoriesInUse(rows)).toEqual(['Food', '', 'Salary', 'Transport']);
  });
});
