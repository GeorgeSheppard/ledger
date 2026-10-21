import { describe, expect, it } from 'vitest';
import {
  datePresets,
  formatDay,
  formatMonth,
  isIsoDate,
  monthKey,
  todayIso,
  yearOf,
} from './dates';

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

  it('shows the year so dates from different years are not ambiguous', () => {
    expect(yearOf('2025-12-23')).toBe('2025');
    expect(yearOf('2026-01-23')).toBe('2026');
  });

  it('builds date presets, handling January and month lengths', () => {
    const byId = (today: string) => Object.fromEntries(datePresets(today).map((p) => [p.id, p]));
    expect(byId('2026-10-17')['this-month']).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(byId('2026-10-17')['last-month']).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(byId('2026-10-17')['last-12-months']).toMatchObject({
      from: '2025-10-18',
      to: '2026-10-17',
    });
    expect(byId('2026-01-05')['last-month']).toMatchObject({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(byId('2026-03-31')['last-month']).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(byId('2026-10-17')['this-year']).toMatchObject({ from: '2026-01-01', to: '2026-12-31' });
  });
});
