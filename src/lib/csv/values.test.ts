import { describe, expect, it } from 'vitest';
import { detectDateFormat, parseAmount, parseDate } from './values';

describe('parseDate', () => {
  it('reads each format', () => {
    expect(parseDate('2026-03-07', 'ymd')).toBe('2026-03-07');
    expect(parseDate('2026/3/7', 'ymd')).toBe('2026-03-07');
    expect(parseDate('07/03/2026', 'dmy')).toBe('2026-03-07');
    expect(parseDate('7.3.26', 'dmy')).toBe('2026-03-07');
    expect(parseDate('03/07/2026', 'mdy')).toBe('2026-03-07');
    expect(parseDate('7 Mar 2026', 'dmy-name')).toBe('2026-03-07');
    expect(parseDate('07-March-26', 'dmy-name')).toBe('2026-03-07');
  });

  it('ignores a time part', () => {
    expect(parseDate('2026-03-07T14:22:01Z', 'ymd')).toBe('2026-03-07');
    expect(parseDate('07/03/2026 14:22', 'dmy')).toBe('2026-03-07');
  });

  it('rejects impossible dates and other formats', () => {
    expect(parseDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseDate('13/13/2026', 'mdy')).toBeNull();
    expect(parseDate('2026-03-07', 'dmy')).toBeNull();
    expect(parseDate('hello', 'ymd')).toBeNull();
  });
});

describe('detectDateFormat', () => {
  it('prefers day-first when ambiguous', () => {
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBe('dmy');
  });

  it('picks month-first when only that fits', () => {
    expect(detectDateFormat(['01/02/2026', '12/31/2026'])).toBe('mdy');
  });

  it('recognises ISO and month names, and gives null for non-dates', () => {
    expect(detectDateFormat(['2026-01-31', ''])).toBe('ymd');
    expect(detectDateFormat(['5 Oct 2026'])).toBe('dmy-name');
    expect(detectDateFormat(['Coffee', '12.50'])).toBeNull();
  });
});

describe('parseAmount', () => {
  it.each([
    ['12.50', 12.5],
    ['-12.50', -12.5],
    ['+3', 3],
    ['£1,234.56', 1234.56],
    ['-$1,234.56', -1234.56],
    ['(45.00)', -45],
    ['45.00-', -45],
    ['45.00 DR', -45],
    ['45.00 CR', 45],
    ['1.234,56', 1234.56],
    ['-1,5', -1.5],
    ['€ 9,99', 9.99],
    ['0.1', 0.1],
    ['-0.00', 0],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('gives null for blanks and text', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('Coffee')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
  });
});
