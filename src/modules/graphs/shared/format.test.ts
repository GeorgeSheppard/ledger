import { describe, expect, it } from 'vitest';
import { formatTick } from './format';

const utc = (y: number, m: number, d = 1) => Date.UTC(y, m - 1, d);

describe('formatTick', () => {
  it('leaves out the year unless asked', () => {
    expect(formatTick(utc(2026, 4), 'month')).toBe(formatTick(utc(2025, 4), 'month'));
    expect(formatTick(utc(2026, 4, 6), 'week')).not.toMatch(/26/);
  });

  it('adds the year to month, week and first-of-month labels', () => {
    expect(formatTick(utc(2026, 4), 'month', true)).toMatch(/Apr.*26/);
    expect(formatTick(utc(2026, 4, 6), 'week', true)).toMatch(/6.*Apr.*26|Apr.*6.*26/);
    expect(formatTick(utc(2026, 4), 'day', true)).toMatch(/Apr.*26|26.*Apr/);
  });

  it('keeps plain day numbers plain', () => {
    expect(formatTick(utc(2026, 4, 9), 'day', true)).toBe('9');
  });
});
