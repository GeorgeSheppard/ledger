import { describe, expect, it } from 'vitest';
import { monthPeriod } from './period';
import { emptyHistory, goBack, selectPeriod } from './periodHistory';

const oct = monthPeriod('2026-10');
const year = { from: '2026-01-01', to: '2026-12-31' };

describe('period history', () => {
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
