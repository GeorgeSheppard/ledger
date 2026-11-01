import type { Account, Transaction } from '../domain/types';
import type { AccountLedger } from '../metrics/netWorth';

/**
 * Credit cards and loans. A tab marked `inverted` records amounts from the account's own side:
 * a purchase or interest charge is positive (the balance owed grows), a payment is negative. That
 * is how card statements and loan CSVs read, so they can be imported unchanged.
 *
 * Wherever Ledger counts what the user has (balances in the accounts list, net worth, the balances
 * graph, income and spending, the money-flow diagram) it flips the sign of an inverted account's
 * amounts and running totals, so a purchase is money out and the balance owed is a negative
 * contribution to net worth. The tab itself, its Total column and the transaction table stay as the
 * sheet has them. Payments between a bank account and a card pair up as transfers, as before.
 */

const signed = new WeakMap<readonly Transaction[], Transaction[]>();

/** The transactions as the user's money sees them: negated for an inverted account, else unchanged. */
export function asMoney(account: Account, transactions: Transaction[]): Transaction[] {
  if (!account.inverted) return transactions;
  let flipped = signed.get(transactions);
  if (!flipped) {
    flipped = transactions.map((t) => ({ ...t, amount: negate(t.amount), total: negate(t.total) }));
    signed.set(transactions, flipped);
  }
  return flipped;
}

/** Every account with its transactions in money terms. */
export function moneyLedgers(
  accounts: readonly Account[],
  transactionsByAccount: Readonly<Record<number, Transaction[]>>
): AccountLedger[] {
  return accounts.map((account) => ({
    account,
    transactions: asMoney(account, transactionsByAccount[account.id] ?? []),
  }));
}

/** `-x`, but `0` rather than `-0`. */
function negate(amount: number): number {
  return amount === 0 ? 0 : -amount;
}
