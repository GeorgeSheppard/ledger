import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../domain/types';
import {
  addCategory,
  categoryColor,
  completeCategories,
  ignoredCategoryNames,
  setCategoryExcluded,
  countUsage,
  moveCategory,
  recolorCategory,
  removeCategory,
  searchCategories,
  usageOf,
  validateCategoryName,
} from './categories';
import {
  CATEGORY_PALETTE,
  nextCategoryColor,
  stableCategoryColor,
  UNKNOWN_CATEGORY_COLOR,
} from './palette';

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

describe('completeCategories', () => {
  const tx = (category: string) => ({ category });

  it('builds the list from the transactions when there is none', () => {
    const result = completeCategories([], [tx('Rent'), tx('rent'), tx(''), tx('Food')]);
    expect(result.map((c) => c.name)).toEqual(['Food', 'Rent']);
    for (const c of result) expect(CATEGORY_PALETTE).toContain(c.color);
    expect(new Set(result.map((c) => c.color)).size).toBe(2);
  });

  it('keeps existing entries, adds missing ones and colours blanks', () => {
    const result = completeCategories(
      [
        { name: 'Rent', color: '#d9534f' },
        { name: 'Fun', color: '' },
      ],
      [tx('RENT'), tx('Travel')]
    );
    expect(result[0]).toEqual({ name: 'Rent', color: '#d9534f' });
    expect(result.map((c) => c.name)).toEqual(['Rent', 'Fun', 'Travel']);
    expect(result.every((c) => /^#[0-9a-f]{6}$/.test(c.color))).toBe(true);
    expect(result[1]!.color).not.toBe('#d9534f');
  });

  it('gives the same colour for the same name on every load', () => {
    expect(completeCategories([], [tx('Pets')])).toEqual(
      completeCategories([], [tx('pets')]).map((c) => ({ ...c, name: 'Pets' }))
    );
    expect(stableCategoryColor('Pets')).toBe(stableCategoryColor(' pets '));
  });
});

describe('excluded categories', () => {
  it('toggles the flag on one category by name', () => {
    const on = setCategoryExcluded(list, 'rent', true);
    expect(on[1]).toEqual({ name: 'Rent', color: '#d9534f', excluded: true });
    expect(on[0]).toEqual(list[0]);
    expect(setCategoryExcluded(on, 'Rent', false)).toEqual(list);
  });

  it('lists the excluded names lower-cased', () => {
    expect(ignoredCategoryNames(setCategoryExcluded(list, 'Eating out', true))).toEqual(
      new Set(['eating out'])
    );
    expect(addCategory(list, 'Transfer', '#abcdef', true).at(-1)?.excluded).toBe(true);
  });
});
