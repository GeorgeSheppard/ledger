import { describe, expect, it } from 'vitest';
import { formatDay, formatMonth, isIsoDate, monthKey, todayIso } from './dates';

describe('dates', () => {
  it('validates ISO dates including calendar rules', () => {
    expect(isIsoDate('2026-10-17')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('17/10/2026')).toBe(false);
  });

  it('formats today in local time', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('derives and formats months', () => {
    expect(monthKey('2026-10-17')).toBe('2026-10');
    expect(formatMonth('2026-10')).toContain('2026');
    expect(formatDay('2026-10-17')).toContain('17');
    expect(formatDay('nonsense')).toBe('nonsense');
  });
});
