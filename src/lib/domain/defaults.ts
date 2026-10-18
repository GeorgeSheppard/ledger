import type { Category } from './types';

/** Categories a brand new ledger starts with. Users can rename, recolour or delete them. */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Income', color: '#2f9e6b' },
  { name: 'Housing', color: '#d9534f' },
  { name: 'Bills', color: '#c2577f' },
  { name: 'Groceries', color: '#4f7cff' },
  { name: 'Eating out', color: '#e8913a' },
  { name: 'Transport', color: '#8e6bd6' },
  { name: 'Shopping', color: '#d4a72c' },
  { name: 'Health', color: '#3aa6b9' },
  { name: 'Entertainment', color: '#b55fc4' },
  { name: 'Transfers', color: '#8b8d98' },
];

export const DEFAULT_ACCOUNT_NAME = 'Current account';
