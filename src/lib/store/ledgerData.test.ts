import { describe, expect, it } from 'vitest';
import type { TransactionInput } from '../domain/types';
import {
  addTransactions,
  deleteTransaction,
  deleteTransactions,
  rebase,
  renameAccount,
  renameCategory,
  migrateCategory,
  countCategoryUse,
  sameData,
  sortAllByDate,
  toSnapshot,
  updateTransaction,
  type LedgerData,
} from './ledgerData';

const tx = (date: string, amount: number, note = ''): TransactionInput => ({
  date,
  category: '',
  amount,
  note,
});

function ledger(rows: TransactionInput[]): LedgerData {
  return {
    accounts: [{ id: 1, name: 'Current' }],
    rows: { 1: rows },
    categories: [{ name: 'Food', color: '#4f7cff' }],
    dashboard: null,
    paychecks: null,
  };
}

const notes = (data: LedgerData) => (data.rows[1] ?? []).map((r) => r.note);

describe('addTransactions', () => {
  it('inserts older rows in date order, after rows on the same day, and reports their rows', () => {
    const data = ledger([tx('2026-01-01', 100, 'a'), tx('2026-01-05', 10, 'b')]);
    const result = addTransactions(data, 1, [
      tx('2026-01-09', 1, 'late'),
      tx('2026-01-01', 5, 'c'),
    ]);
    expect(notes(result.data)).toEqual(['a', 'c', 'b', 'late']);
    expect(result.rows).toEqual([5, 3]);
    expect(notes(data)).toEqual(['a', 'b']);
  });

  it('keeps the running total right for backdated rows', () => {
    const data = ledger([tx('2026-01-01', 100), tx('2026-01-05', -30)]);
    const { data: next } = addTransactions(data, 1, [tx('2026-01-02', 50)]);
    expect(toSnapshot(next, []).transactionsByAccount[1]!.map((t) => t.total)).toEqual([
      100, 150, 120,
    ]);
  });

  it('rejects invalid input and unknown accounts', () => {
    const data = ledger([]);
    expect(() => addTransactions(data, 1, [tx('01/02/2026', 1)])).toThrow('YYYY-MM-DD');
    expect(() => addTransactions(data, 1, [tx('2026-01-01', NaN)])).toThrow('number');
    expect(() => addTransactions(data, 2, [tx('2026-01-01', 1)])).toThrow('Unknown account');
  });
});

describe('updateTransaction and deleteTransaction', () => {
  const data = ledger([
    tx('2026-01-01', 1, 'a'),
    tx('2026-01-05', 2, 'b'),
    tx('2026-01-09', 3, 'c'),
  ]);

  it('edits in place, or moves the row when its date changes', () => {
    expect(notes(updateTransaction(data, 1, 3, tx('2026-01-05', 9, 'B')))).toEqual(['a', 'B', 'c']);
    expect(notes(updateTransaction(data, 1, 3, tx('2026-02-01', 2, 'b')))).toEqual(['a', 'c', 'b']);
  });

  it('deletes by row and rejects unknown rows', () => {
    expect(notes(deleteTransaction(data, 1, 2))).toEqual(['b', 'c']);
    expect(() => deleteTransaction(data, 1, 5)).toThrow('Unknown row');
    expect(notes(deleteTransactions(data, 1, [4, 2]))).toEqual(['b']);
    expect(() => deleteTransactions(data, 1, [2, 9])).toThrow('Unknown row');
    expect(() => updateTransaction(data, 1, 1, tx('2026-01-01', 1))).toThrow('Unknown row');
  });
});

describe('renameCategory', () => {
  it('renames the category and every transaction using it', () => {
    const data = ledger([{ ...tx('2026-01-01', 1), category: 'Food' }, tx('2026-01-02', 2)]);
    const next = renameCategory(data, 'Food', 'Groceries');
    expect(next.categories[0]!.name).toBe('Groceries');
    expect(next.rows[1]!.map((r) => r.category)).toEqual(['Groceries', '']);
  });
});

describe('migrateCategory', () => {
  const data = () => ({
    ...ledger([
      { ...tx('2026-01-01', 1), category: 'Food' },
      { ...tx('2026-01-02', 2), category: 'food' },
      { ...tx('2026-01-03', 3), category: 'Rent' },
    ]),
    categories: [
      { name: 'Food', color: '#d9534f' },
      { name: 'Groceries', color: '#4f7cff' },
      { name: 'Rent', color: '#e8913a' },
    ],
  });

  it('moves every matching transaction and counts them first', () => {
    expect(countCategoryUse(data(), 'Food')).toBe(2);
    const next = migrateCategory(data(), 'Food', 'groceries');
    expect(next.rows[1]!.map((r) => r.category)).toEqual(['Groceries', 'Groceries', 'Rent']);
    expect(next.categories.find((c) => c.name === 'Food')!.archived).toBeUndefined();
  });

  it('archives the old category when asked, and adds a new target', () => {
    const next = migrateCategory(data(), 'Food', 'Shopping', true);
    expect(next.categories.find((c) => c.name === 'Food')!.archived).toBe(true);
    expect(next.categories.map((c) => c.name)).toContain('Shopping');
    expect(countCategoryUse(next, 'Shopping')).toBe(2);
  });

  it('does nothing when the target is the same category', () => {
    const before = data();
    expect(migrateCategory(before, 'Food', 'FOOD', true)).toBe(before);
  });
});

describe('renameAccount', () => {
  it('moves categories limited to the account onto its new name', () => {
    const data = {
      ...ledger([]),
      categories: [
        { name: 'Fees', color: '#4f7cff', accounts: ['Current', 'ISA'] },
        { name: 'Food', color: '#d9534f' },
      ],
    };
    const next = renameAccount(data, 1, 'Main');
    expect(next.accounts[0]!.name).toBe('Main');
    expect(next.categories[0]!.accounts).toEqual(['Main', 'ISA']);
    expect(next.categories[1]).toEqual(data.categories[1]);
  });
});

describe('sortAllByDate', () => {
  it('sorts out-of-order tabs and leaves sorted data untouched', () => {
    const sorted = ledger([tx('2026-01-01', 1)]);
    expect(sortAllByDate(sorted)).toBe(sorted);
    const unsorted = ledger([tx('2026-02-01', 1, 'feb'), tx('2026-01-01', 1, 'jan')]);
    expect(notes(sortAllByDate(unsorted))).toEqual(['jan', 'feb']);
  });
});

describe('rebase', () => {
  it('keeps local edits to the tabs they touched and takes everything else from the sheet', () => {
    const base: LedgerData = {
      accounts: [
        { id: 1, name: 'Current' },
        { id: 2, name: 'Savings' },
      ],
      rows: { 1: [tx('2026-01-01', 1)], 2: [tx('2026-01-01', 2)] },
      categories: [],
      dashboard: null,
      paychecks: null,
    };
    const local: LedgerData = {
      ...base,
      accounts: [...base.accounts, { id: 3, name: 'New' }],
      rows: { ...base.rows, 1: [tx('2026-01-01', 1), tx('2026-01-02', 5)], 3: [] },
      dashboard: { widgets: [] },
    };
    const fresh: LedgerData = {
      ...base,
      accounts: [
        { id: 1, name: 'Current' },
        { id: 2, name: 'Savings (renamed in Sheets)' },
      ],
      rows: { 1: [tx('2026-01-01', 1)], 2: [tx('2026-01-01', 2), tx('2026-01-03', 7)] },
      categories: [{ name: 'Added in Sheets', color: '#000000' }],
    };
    const merged = rebase(fresh, base, local);
    expect(merged.accounts.map((a) => a.name)).toEqual([
      'Current',
      'Savings (renamed in Sheets)',
      'New',
    ]);
    expect(merged.rows[1]).toEqual(local.rows[1]);
    expect(merged.rows[2]).toEqual(fresh.rows[2]);
    expect(merged.categories).toEqual(fresh.categories);
    expect(merged.dashboard).toEqual({ widgets: [] });
    expect(sameData(rebase(fresh, base, base), fresh)).toBe(true);
  });
});
