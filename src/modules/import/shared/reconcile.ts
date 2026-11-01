import type { TransactionInput } from '../../../lib/domain/types';
import { importMatchKey } from '../../../lib/transactions/duplicates';

/**
 * Deciding which imported rows are already in the account. A row counts as existing when an
 * existing transaction has the same date and amount; the note is ignored. Matching is one-to-one:
 * two identical coffees in the CSV against one in the sheet means one is existing and one is new.
 */

export type ReconcileStatus = 'new' | 'existing';

type Comparable = Pick<TransactionInput, 'date' | 'amount'> & { note?: string };

/** The status of each incoming row, in the same order. */
export function reconcile(
  incoming: readonly Comparable[],
  existing: readonly Comparable[]
): ReconcileStatus[] {
  const available = new Map<string, number>();
  for (const t of existing) {
    const key = importMatchKey(t);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  return incoming.map((t) => {
    const key = importMatchKey(t);
    const left = available.get(key) ?? 0;
    if (left === 0) return 'new';
    available.set(key, left - 1);
    return 'existing';
  });
}
