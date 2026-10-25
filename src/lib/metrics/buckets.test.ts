import { describe, expect, it } from 'vitest';
import { bucketKeyOf, bucketsBetween, bucketSpan, granularityFor } from './buckets';

describe('bucketsBetween', () => {
  it('cuts calendar months', () => {
    expect(bucketsBetween('2026-01-20', '2026-03-02', 'month')).toEqual([
      { key: '2026-01', start: '2026-01-01', end: '2026-01-31' },
      { key: '2026-02', start: '2026-02-01', end: '2026-02-28' },
      { key: '2026-03', start: '2026-03-01', end: '2026-03-31' },
    ]);
  });

  it('cuts weeks that start on Monday, including the one the range starts in', () => {
    // 2026-04-08 is a Wednesday.
    expect(bucketsBetween('2026-04-08', '2026-04-20', 'week')).toEqual([
      { key: '2026-04-06', start: '2026-04-06', end: '2026-04-12' },
      { key: '2026-04-13', start: '2026-04-13', end: '2026-04-19' },
      { key: '2026-04-20', start: '2026-04-20', end: '2026-04-26' },
    ]);
  });

  it('cuts days across a month end and returns nothing for a backwards range', () => {
    expect(bucketsBetween('2026-02-27', '2026-03-01', 'day').map((b) => b.key)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
    expect(bucketsBetween('2026-03-02', '2026-03-01', 'day')).toEqual([]);
  });
});

describe('bucketKeyOf', () => {
  it('names the bucket a date falls in', () => {
    expect(bucketKeyOf('2026-04-12', 'month')).toBe('2026-04');
    expect(bucketKeyOf('2026-04-12', 'week')).toBe('2026-04-06'); // a Sunday
    expect(bucketKeyOf('2026-04-12', 'day')).toBe('2026-04-12');
  });
});

describe('bucketSpan', () => {
  it('runs to midnight after the last day', () => {
    const [from, to] = bucketSpan({ key: 'k', start: '2026-04-06', end: '2026-04-12' });
    expect((to - from) / 86_400_000).toBe(7);
  });
});

describe('granularityFor', () => {
  it('cuts a month into days, a few months into weeks and longer into months', () => {
    expect(granularityFor(31)).toBe('day');
    expect(granularityFor(90)).toBe('week');
    expect(granularityFor(181)).toBe('month');
    expect(granularityFor(400)).toBe('month');
  });
});
