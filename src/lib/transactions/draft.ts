import type { Transaction, TransactionInput } from '../domain/types';
import { amountToInput, parseAmount } from './amount';
import { isIsoDate } from './dates';

/**
 * A transaction while it is being edited: every field is the raw text in its input, so half-typed
 * values survive re-renders. `validateDraft` turns it into a `TransactionInput` for the repository.
 */
export interface TransactionDraft {
  date: string;
  category: string;
  amount: string;
  note: string;
}

export type DraftField = keyof TransactionDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export type DraftResult =
  { ok: true; input: TransactionInput } | { ok: false; errors: DraftErrors };

export function emptyDraft(today: string): TransactionDraft {
  return { date: today, category: '', amount: '', note: '' };
}

export function draftFromTransaction(transaction: Transaction): TransactionDraft {
  return {
    date: transaction.date,
    category: transaction.category,
    amount: amountToInput(transaction.amount),
    note: transaction.note,
  };
}

export function validateDraft(draft: TransactionDraft): DraftResult {
  const errors: DraftErrors = {};
  const date = draft.date.trim();
  if (!isIsoDate(date)) errors.date = 'Enter a valid date';
  const amount = parseAmount(draft.amount);
  if (amount === null) errors.amount = 'Enter an amount, e.g. -12.50';
  else if (amount === 0) errors.amount = 'Amount cannot be zero';
  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };
  return {
    ok: true,
    input: { date, category: draft.category.trim(), amount, note: draft.note.trim() },
  };
}

/** Whether the draft differs from what it started as (so cancelling would lose work). */
export function isDraftDirty(draft: TransactionDraft, original: TransactionDraft): boolean {
  return (Object.keys(draft) as DraftField[]).some(
    (field) => draft[field].trim() !== original[field].trim()
  );
}
