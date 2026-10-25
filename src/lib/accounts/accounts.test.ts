import { describe, expect, it } from 'vitest';
import type { Account } from '../domain/types';
import { filterAccounts, findAccountByParam, validateAccountName } from './accounts';

const accounts: Account[] = [
  { id: 1, name: 'Current account' },
  { id: 2, name: 'Savings' },
  { id: 7, name: 'Credit card' },
];

describe('accounts', () => {
  it('validates tab names', () => {
    expect(validateAccountName(accounts, '')).toBe('Enter a name');
    expect(validateAccountName(accounts, '_Hidden')).toMatch(/reserved/);
    expect(validateAccountName(accounts, 'Paychecks')).toMatch(/reserved/);
    expect(validateAccountName(accounts, 'Ledger_x')).toMatch(/reserved/);
    expect(validateAccountName(accounts, 'A/B')).toMatch(/cannot contain/);
    expect(validateAccountName(accounts, 'savings')).toMatch(/already exists/);
    expect(validateAccountName(accounts, 'savings', 2)).toBeNull();
    expect(validateAccountName(accounts, 'Cash')).toBeNull();
  });

  it('resolves route params', () => {
    expect(findAccountByParam(accounts, '7')?.name).toBe('Credit card');
    expect(findAccountByParam(accounts, '3')).toBeUndefined();
    expect(findAccountByParam(accounts, 'x1')).toBeUndefined();
    expect(findAccountByParam(accounts, undefined)).toBeUndefined();
  });

  it('filters by name', () => {
    expect(filterAccounts(accounts, 'c').map((a) => a.id)).toEqual([1, 7]);
    expect(filterAccounts(accounts, 'zzz')).toEqual([]);
  });
});
