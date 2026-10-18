import type { Category } from './types';

/** Categories a brand new ledger starts with. Users can rename, recolour or delete them. */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Income', color: '#239382' },
  { name: 'Housing', color: '#fe7ccb' },
  { name: 'Bills', color: '#dba833' },
  { name: 'Groceries', color: '#7e68e3' },
  { name: 'Eating out', color: '#d64b30' },
  { name: 'Transport', color: '#46bdfe' },
  { name: 'Shopping', color: '#19d27f' },
  { name: 'Health', color: '#c44a9e' },
  { name: 'Entertainment', color: '#9a7c31' },
  { name: 'Transfers', color: '#bb9dff', excluded: true },
];

export const DEFAULT_ACCOUNT_NAME = 'Current account';
