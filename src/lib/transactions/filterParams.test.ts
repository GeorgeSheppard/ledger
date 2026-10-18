import { describe, expect, it } from 'vitest';
import { filterParams, filtersFromParams } from './filterParams';
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
