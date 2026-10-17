import { describe, expect, it } from 'vitest';
import { guessAccount } from './account';

describe('guessAccount', () => {
  const accounts = [
    { id: 1, name: 'Current' },
    { id: 2, name: 'Current account' },
    { id: 3, name: 'Credit card' },
  ];

  it('picks the longest account name found in the file name', () => {
    expect(guessAccount('current-account_2026-03.csv', accounts)?.id).toBe(2);
    expect(guessAccount('Credit Card Statement.csv', accounts)?.id).toBe(3);
  });

  it('only matches whole words', () => {
    expect(guessAccount('currently.csv', accounts.slice(1))?.id).toBe(2);
  });

  it('falls back to the first account, or null with none', () => {
    expect(guessAccount('export.csv', accounts)?.id).toBe(1);
    expect(guessAccount('export.csv', [])).toBeNull();
  });
});
