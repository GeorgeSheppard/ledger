import { describe, expect, it } from 'vitest';
import { amountToInput, formatAmount, parseAmount, roundCents } from './amount';

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['-12.5', -12.5],
    ['+12.50', 12.5],
    ['1,234.56', 1234.56],
    ['£12', 12],
    ['-£12.00', -12],
    ['(12.00)', -12],
    ['12-', -12],
    ['−7', -7],
    ['.5', 0.5],
    [' 3.333 ', 3.33],
    ['0', 0],
  ])('parses %j as %d', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it.each(['', 'abc', '1.2.3', '--', '12a'])('rejects %j', (text) => {
    expect(parseAmount(text)).toBeNull();
  });
});

describe('formatAmount', () => {
  it('uses two decimals and a true minus sign', () => {
    expect(formatAmount(-12)).toMatch(/^−12[.,]00$/);
    expect(formatAmount(3.5)).toMatch(/^3[.,]50$/);
  });

  it('adds a plus sign only when asked', () => {
    expect(formatAmount(5, { signed: true }).startsWith('+')).toBe(true);
    expect(formatAmount(0, { signed: true }).startsWith('+')).toBe(false);
  });
});

describe('roundCents and amountToInput', () => {
  it('drops float noise', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(amountToInput(-64.2 - 7.5)).toBe('-71.7');
  });
});
