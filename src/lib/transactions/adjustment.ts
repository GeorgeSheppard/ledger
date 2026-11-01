import type { Transaction, TransactionInput } from '../domain/types';
import { roundCents } from './amount';

/**
 * Balance adjustments: one ordinary row that moves an account to a balance the user read off their
 * bank, for accounts whose exact interest or growth is not known (savings, investments).
 *
 * The row is plain: a date, an amount and the note below, like any other. Nothing else marks it, so
 * the sheet stays usable in Excel. It counts as income when positive and as spending when negative
 * (interest earned is income), like any uncategorised row.
 */

/** The note on an adjustment row. */
export const BALANCE_ADJUSTMENT_NOTE = 'Balance adjustment';

export function isBalanceAdjustment(transaction: Transaction): boolean {
  return transaction.note.trim().toLowerCase().startsWith(BALANCE_ADJUSTMENT_NOTE.toLowerCase());
}

/**
 * What the account holds at the end of `date`: the sum of every row dated on or before it, in the
 * user's money. Amounts are already in money terms (cards included), so this is just the sum.
 */
export function balanceOn(
  transactions: readonly Pick<Transaction, 'date' | 'amount'>[],
  date: string
): number {
  let sum = 0;
  for (const t of transactions) if (t.date <= date) sum += t.amount;
  return roundCents(sum);
}

/**
 * The row that makes the account's balance on `date` equal `target` (in the user's money), or null
 * when it already does. Later rows are untouched and simply carry on from the new balance.
 */
export function planBalanceAdjustment(
  transactions: readonly Pick<Transaction, 'date' | 'amount'>[],
  date: string,
  target: number
): { current: number; difference: number; input: TransactionInput } | null {
  const current = balanceOn(transactions, date);
  const difference = roundCents(target - current);
  if (difference === 0) return null;
  return {
    current,
    difference,
    input: {
      date,
      category: '',
      amount: difference,
      note: BALANCE_ADJUSTMENT_NOTE,
    },
  };
}
