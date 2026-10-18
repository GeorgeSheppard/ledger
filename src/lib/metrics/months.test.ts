import { describe, expect, it } from 'vitest';
import { addMonths, monthEnd, monthOf, monthsBetween } from './months';

describe('months', () => {
  it('takes the month of a date', () => {
    expect(monthOf('2026-04-30')).toBe('2026-04');
  });

  it('adds and subtracts months across years', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-05', 0)).toBe('2026-05');
  });

  it('lists months inclusively', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(monthsBetween('2026-03', '2026-02')).toEqual([]);
  });

  it('finds the last day of the month', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(monthEnd('2026-12')).toBe('2026-12-31');
  });
});
