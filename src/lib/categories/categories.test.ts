import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../domain/types';
import {
  addCategory,
  categoryColor,
  countUsage,
  moveCategory,
  recolorCategory,
  removeCategory,
  searchCategories,
  usageOf,
  validateCategoryName,
} from './categories';
import { CATEGORY_PALETTE, nextCategoryColor, UNKNOWN_CATEGORY_COLOR } from './palette';

const list: Category[] = [
  { name: 'Groceries', color: '#4f7cff' },
  { name: 'Rent', color: '#d9534f' },
  { name: 'Eating out', color: '#e8913a' },
];

describe('category list operations', () => {
  it('validates names case-insensitively', () => {
    expect(validateCategoryName(list, '  ')).toBe('Enter a name');
    expect(validateCategoryName(list, 'groceries')).toBe('"Groceries" already exists');
    expect(validateCategoryName(list, 'groceries', 'Groceries')).toBeNull();
    expect(validateCategoryName(list, 'Rent', 'Groceries')).not.toBeNull();
    expect(validateCategoryName(list, 'Travel')).toBeNull();
  });

  it('adds with the next free palette colour without mutating', () => {
    const next = addCategory(list, ' Travel ');
    expect(next.at(-1)).toEqual({ name: 'Travel', color: nextCategoryColor(list) });
    expect(list).toHaveLength(3);
    expect(() => addCategory(list, 'rent')).toThrow();
  });

  it('recolours, removes and reorders', () => {
    expect(recolorCategory(list, 'rent', '#ABCDEF')[1]?.color).toBe('#abcdef');
    expect(() => recolorCategory(list, 'Rent', 'red')).toThrow();
    expect(removeCategory(list, 'RENT').map((c) => c.name)).toEqual(['Groceries', 'Eating out']);
    expect(moveCategory(list, 'Eating out', -1).map((c) => c.name)).toEqual([
      'Groceries',
      'Eating out',
      'Rent',
    ]);
    expect(moveCategory(list, 'Groceries', -1).map((c) => c.name)).toEqual(list.map((c) => c.name));
  });

  it('looks up colours with a fallback', () => {
    expect(categoryColor(list, 'rent')).toBe('#d9534f');
    expect(categoryColor(list, 'Mystery')).toBe(UNKNOWN_CATEGORY_COLOR);
  });

  it('counts usage across transactions', () => {
    const tx = (category: string) => ({ category }) as Transaction;
    const counts = countUsage([tx('Rent'), tx('rent '), tx(''), tx('Groceries')]);
    expect(usageOf(counts, 'Rent')).toBe(2);
    expect(usageOf(counts, 'Groceries')).toBe(1);
    expect(usageOf(counts, 'Travel')).toBe(0);
  });

  it('searches prefix matches first', () => {
    expect(searchCategories(list, 'e').map((c) => c.name)).toEqual([
      'Eating out',
      'Groceries',
      'Rent',
    ]);
    expect(searchCategories(list, '')).toHaveLength(3);
  });
});

describe('nextCategoryColor', () => {
  it('cycles once the palette is used up', () => {
    const all = CATEGORY_PALETTE.map((color, i) => ({ name: `c${i}`, color }));
    expect(CATEGORY_PALETTE).toContain(nextCategoryColor(all));
  });
});
