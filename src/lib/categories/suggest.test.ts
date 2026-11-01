import { describe, expect, it } from 'vitest';
import { buildCategoryIndex } from './suggest';

const tx = (note: string, category: string, date = '2026-01-01') => ({ note, category, date });

describe('buildCategoryIndex', () => {
  it('picks the most common category for a note', () => {
    const index = buildCategoryIndex([
      tx('Tesco', 'Groceries'),
      tx('Tesco', 'Groceries'),
      tx('Tesco', 'Household'),
    ]);
    expect(index.suggest('Tesco')).toBe('Groceries');
  });

  it('matches on the trimmed note, ignoring case', () => {
    const index = buildCategoryIndex([tx('  TESCO ', 'Groceries')]);
    expect(index.suggest('tesco')).toBe('Groceries');
    expect(index.suggest(' Tesco  ')).toBe('Groceries');
  });

  it('needs an exact match', () => {
    const index = buildCategoryIndex([tx('Tesco', 'Groceries')]);
    expect(index.suggest('Tesco Express')).toBeUndefined();
    expect(index.suggest('')).toBeUndefined();
  });

  it('ignores uncategorised rows when counting', () => {
    const index = buildCategoryIndex([
      tx('Shop', ''),
      tx('Shop', '  '),
      tx('Shop', ''),
      tx('Shop', 'Clothes'),
    ]);
    expect(index.suggest('Shop')).toBe('Clothes');
    expect(buildCategoryIndex([tx('Shop', '')]).suggest('Shop')).toBeUndefined();
  });

  it('breaks ties by the most recent use, whatever the order', () => {
    const rows = [tx('Cafe', 'Eating out', '2026-03-01'), tx('Cafe', 'Work', '2026-05-01')];
    expect(buildCategoryIndex(rows).suggest('Cafe')).toBe('Work');
    expect(buildCategoryIndex([...rows].reverse()).suggest('Cafe')).toBe('Work');
  });

  it('breaks a remaining tie by name', () => {
    const rows = [tx('X', 'B'), tx('X', 'A')];
    expect(buildCategoryIndex(rows).suggest('X')).toBe('A');
  });

  it('skips disallowed categories and falls back to the next most common', () => {
    const index = buildCategoryIndex([tx('Gym', 'Old'), tx('Gym', 'Old'), tx('Gym', 'Fitness')]);
    const notOld = (name: string) => name !== 'Old';
    expect(index.suggest('Gym')).toBe('Old');
    expect(index.suggest('Gym', notOld)).toBe('Fitness');
    expect(index.suggest('Gym', () => false)).toBeUndefined();
  });
});
