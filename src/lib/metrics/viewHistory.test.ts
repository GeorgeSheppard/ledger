import { describe, expect, it } from 'vitest';
import { monthPeriod } from './period';
import { clearCategories, emptyHistory, goBack, selectPeriod, toggleCategory } from './viewHistory';

const oct = monthPeriod('2026-10');
const year = { from: '2026-01-01', to: '2026-12-31' };

describe('view history', () => {
  it('has nothing to go back to at first', () => {
    expect(goBack(emptyHistory)).toBe(emptyHistory);
  });

  it('goes back through each change in turn, ending on the initial range', () => {
    let h = selectPeriod(emptyHistory, oct, year);
    h = selectPeriod(h, oct, monthPeriod('2026-03'));
    h = goBack(h);
    expect(h.picked).toEqual(year);
    h = goBack(h);
    expect(h.picked).toEqual(oct);
    expect(h.past).toEqual([]);
  });

  it('goes back over category picks and clears, in order with date changes', () => {
    let h = toggleCategory(emptyHistory, oct, 'Food');
    h = selectPeriod(h, oct, year);
    h = toggleCategory(h, oct, 'Rent');
    expect(h.categories).toEqual(['Food', 'Rent']);
    h = clearCategories(h, oct);
    expect(h.categories).toEqual([]);
    h = goBack(h);
    expect(h.categories).toEqual(['Food', 'Rent']);
    h = goBack(h);
    expect(h.categories).toEqual(['Food']);
    expect(h.picked).toEqual(year);
    h = goBack(h);
    expect(h.picked).toEqual(oct);
    h = goBack(h);
    expect(h.categories).toEqual([]);
  });

  it('unselects a category by picking it again, which is also a step back', () => {
    let h = toggleCategory(emptyHistory, oct, 'Food');
    h = toggleCategory(h, oct, 'Food');
    expect(h.categories).toEqual([]);
    expect(h.past).toHaveLength(2);
  });

  it('ignores a pick of the range already shown', () => {
    expect(selectPeriod(emptyHistory, oct, oct)).toBe(emptyHistory);
  });

  it('keeps only the most recent ranges', () => {
    let h = emptyHistory;
    for (let day = 1; day <= 60; day++) {
      h = selectPeriod(h, oct, { from: '2020-01-01', to: `2020-02-${String(day)}` });
    }
    expect(h.past.length).toBeLessThanOrEqual(50);
  });
});
