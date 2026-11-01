import type { Account, TransactionInput } from '../domain/types';
import type { LedgerData } from '../store/ledgerData';

/**
 * Credit cards and loans. A tab marked `inverted` is written from the account's own side: a
 * purchase or interest charge is positive (the balance owed grows), a payment is negative. That is
 * how card statements and loan CSVs read, and it is how the sheet keeps them, so the sheet stays
 * plain and usable in Excel.
 *
 * Inside Ledger there is only one convention: positive is money in, negative is money out. The
 * flip happens once, at the edge of the app. `LedgerStore` runs `toMoneyTerms` on whatever it reads
 * (sheet, file or browser copy) and `toSheetTerms` on whatever it writes. Everything between,
 * filters, totals, graphs, balances, imports, never looks at `Account.inverted`.
 */

/** `-x`, but `0` rather than `-0`. */
export function negate(amount: number): number {
  return amount === 0 ? 0 : -amount;
}

function flipRows(rows: readonly TransactionInput[]): TransactionInput[] {
  return rows.map((r) => ({ ...r, amount: negate(r.amount) }));
}

/** Negates the amounts of every inverted account's rows. Other data is shared with the input. */
function flipInverted(data: LedgerData): LedgerData {
  const inverted = data.accounts.filter((a: Account) => a.inverted);
  if (inverted.length === 0) return data;
  const rows = { ...data.rows };
  for (const account of inverted) rows[account.id] = flipRows(data.rows[account.id] ?? []);
  return { ...data, rows };
}

/** Sheet to app: an inverted account's amounts negated, so every amount reads as money in or out. */
export const toMoneyTerms = flipInverted;

/** App to sheet: the exact inverse of `toMoneyTerms`, so a round trip changes nothing. */
export const toSheetTerms = flipInverted;
