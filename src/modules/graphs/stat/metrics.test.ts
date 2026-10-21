import { describe, expect, it } from 'vitest';
import { includedCategories, statSign } from './metrics';

describe('statSign', () => {
  it('has no transactions for a total', () => {
    expect(statSign('netWorth')).toBeNull();
  });
  it('splits income from spending', () => {
    expect(statSign('income')).toBe('in');
    expect(statSign('spending')).toBe('out');
    expect(statSign('averageSpending')).toBe('out');
    expect(statSign('savingsRate')).toBe('any');
  });
});

describe('includedCategories', () => {
  const rows = [{ category: 'Food' }, { category: 'Rent' }, { category: '' }, { category: 'Food' }];
  it('is empty when nothing is excluded', () => {
    expect(includedCategories(rows, new Set(), 'Uncategorised')).toEqual([]);
    expect(includedCategories(rows, new Set(['nothing']), 'Uncategorised')).toEqual([]);
  });
  it('lists the rest when a category is excluded, matching case-insensitively', () => {
    expect(includedCategories(rows, new Set(['rent']), 'Uncategorised')).toEqual([
      'Food',
      'Uncategorised',
    ]);
  });
});
