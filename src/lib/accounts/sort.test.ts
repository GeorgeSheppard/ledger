import { describe, expect, it } from 'vitest';
import { nextAccountSort, sortAccountRows, type AccountRow } from './sort';

function row(id: number, name: string, balance: number, count: number, lastDate: string | null) {
  return {
    account: { id, name },
    summary: { balance, count, lastDate, monthIn: 0, monthOut: 0 },
  } as AccountRow;
}

const rows = [
  row(1, 'Current', 500, 40, '2026-10-01'),
  row(2, 'savings', 12000, 6, '2026-08-15'),
  row(3, 'Empty', 0, 0, null),
  row(4, 'Card', -300, 120, '2026-10-09'),
];
const names = (sorted: AccountRow[]) => sorted.map((r) => r.account.name);

describe('sortAccountRows', () => {
  it('sorts by name ignoring case', () => {
    expect(names(sortAccountRows(rows, { key: 'name', direction: 'asc' }))).toEqual([
      'Card',
      'Current',
      'Empty',
      'savings',
    ]);
    expect(names(sortAccountRows(rows, { key: 'name', direction: 'desc' }))[0]).toBe('savings');
  });

  it('sorts by balance', () => {
    expect(names(sortAccountRows(rows, { key: 'balance', direction: 'desc' }))).toEqual([
      'savings',
      'Current',
      'Empty',
      'Card',
    ]);
  });

  it('sorts by transaction count', () => {
    expect(names(sortAccountRows(rows, { key: 'count', direction: 'desc' }))[0]).toBe('Card');
    expect(names(sortAccountRows(rows, { key: 'count', direction: 'asc' }))[0]).toBe('Empty');
  });

  it('puts accounts without activity last in both directions', () => {
    const newest = sortAccountRows(rows, { key: 'lastActivity', direction: 'desc' });
    expect(names(newest)).toEqual(['Card', 'Current', 'savings', 'Empty']);
    const oldest = sortAccountRows(rows, { key: 'lastActivity', direction: 'asc' });
    expect(names(oldest)).toEqual(['savings', 'Current', 'Card', 'Empty']);
  });

  it('keeps tab order for ties and does not change its input', () => {
    const tied = [row(2, 'B', 1, 1, null), row(1, 'A', 1, 1, null)];
    expect(names(sortAccountRows(tied, { key: 'balance', direction: 'asc' }))).toEqual(['A', 'B']);
    expect(rows.map((r) => r.account.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('nextAccountSort', () => {
  it('starts names ascending and everything else descending, then flips', () => {
    const name = nextAccountSort(null, 'name');
    expect(name).toEqual({ key: 'name', direction: 'asc' });
    expect(nextAccountSort(name, 'name').direction).toBe('desc');
    expect(nextAccountSort(name, 'lastActivity')).toEqual({
      key: 'lastActivity',
      direction: 'desc',
    });
  });
});
