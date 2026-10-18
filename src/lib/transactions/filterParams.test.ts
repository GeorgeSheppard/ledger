import { describe, expect, it } from 'vitest';
import { categoryTransactionsPath, filterParams, filtersFromParams } from './filterParams';
import { noFilters } from './filters';

describe('filterParams', () => {
  it('round-trips a date range and categories, including no category', () => {
    const query = filterParams({
      from: '2026-04-01',
      to: '2026-04-30',
      categories: ['Eating out', ''],
      accounts: [2, 5],
    });
    expect(filtersFromParams(new URLSearchParams(query))).toEqual({
      ...noFilters,
      from: '2026-04-01',
      to: '2026-04-30',
      categories: ['Eating out', ''],
      accounts: [2, 5],
    });
  });

  it('is empty for no filters, and ignores malformed dates', () => {
    expect(filterParams({})).toBe('');
    expect(filtersFromParams(new URLSearchParams('from=yesterday'))).toEqual(noFilters);
  });
});

describe('categoryTransactionsPath', () => {
  it('opens the list filtered to one category with no dates or accounts', () => {
    const [path, query] = categoryTransactionsPath('/transactions', 'Eating out & drinks').split(
      '?'
    );
    expect(path).toBe('/transactions');
    expect(filtersFromParams(new URLSearchParams(query))).toEqual({
      ...noFilters,
      categories: ['Eating out & drinks'],
    });
  });
});

describe('sign', () => {
  it('travels as in or out and reads back', () => {
    expect(filterParams({ sign: 'out' })).toBe('sign=out');
    expect(filterParams({ sign: 'any' })).toBe('');
    expect(filtersFromParams(new URLSearchParams('sign=in')).sign).toBe('in');
    expect(filtersFromParams(new URLSearchParams('sign=bogus')).sign).toBe('any');
  });
});
