import type { Transaction } from '../domain/types';

/** Builds a transaction for tests. Row numbers follow call order per account. */
export function makeTransactions(
  accountId: number,
  rows: [date: string, amount: number, category?: string, note?: string][]
): Transaction[] {
  let total = 0;
  return rows.map(([date, amount, category = '', note = ''], i) => {
    total += amount;
    return {
      id: `${accountId}:${i + 2}`,
      accountId,
      row: i + 2,
      date,
      category,
      amount,
      note,
      total,
    };
  });
}
