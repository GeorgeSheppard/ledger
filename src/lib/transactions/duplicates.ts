import type { Transaction, TransactionInput } from '../domain/types';

type Comparable = Pick<TransactionInput, 'date' | 'amount' | 'note'>;

/**
 * What makes two transactions "the same": the same date, amount and note (notes compared ignoring
 * case and extra spaces). Used by the importer to spot rows already in the account and by the
 * accounts page to find duplicates.
 */
export function transactionKey({ date, amount, note }: Comparable): string {
  return `${date}|${Math.round(amount * 100)}|${note.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/** Ids of every transaction that has at least one twin in the list (by `transactionKey`). */
export function findDuplicateIds(transactions: readonly Transaction[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const t of transactions) {
    const key = transactionKey(t);
    byKey.set(key, [...(byKey.get(key) ?? []), t.id]);
  }
  const ids = new Set<string>();
  for (const group of byKey.values()) if (group.length > 1) for (const id of group) ids.add(id);
  return ids;
}
