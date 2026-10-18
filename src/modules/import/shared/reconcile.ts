import type { TransactionInput } from '../../../lib/domain/types';

/**
 * Deciding which imported rows are already in the account. A row counts as existing when an
 * existing transaction has the same date, amount and note (notes compared ignoring case and extra
 * spaces). Matching is one-to-one: two identical coffees in the CSV against one in the sheet
 * means one is existing and one is new.
 */

export type ReconcileStatus = 'new' | 'existing';

type Comparable = Pick<TransactionInput, 'date' | 'amount' | 'note'>;

export function transactionKey({ date, amount, note }: Comparable): string {
  return `${date}|${Math.round(amount * 100)}|${note.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** The status of each incoming row, in the same order. */
export function reconcile(
  incoming: readonly Comparable[],
  existing: readonly Comparable[]
): ReconcileStatus[] {
  const available = new Map<string, number>();
  for (const t of existing) {
    const key = transactionKey(t);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  return incoming.map((t) => {
    const key = transactionKey(t);
    const left = available.get(key) ?? 0;
    if (left === 0) return 'new';
    available.set(key, left - 1);
    return 'existing';
  });
}
