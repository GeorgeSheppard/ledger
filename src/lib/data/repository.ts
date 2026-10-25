import type { Account, Category, Transaction, TransactionInput } from '../domain/types';
import type { JsonValue } from '../store/ledgerData';

/**
 * The single seam between the app and wherever the data lives. Features only ever talk to this
 * interface (through `useRepository()`), never to Google APIs directly.
 *
 * The implementation is `LedgerStore` (`../store/ledgerStore.ts`): a working copy of the whole
 * spreadsheet, loaded once and saved back in batches. Edits apply locally at once; they reach the
 * sheet on the next save (every minute, or when the user presses Save).
 *
 * All methods return fresh copies; callers may mutate results freely. Rows are kept in date order,
 * so adding or redating a transaction can change other rows' numbers: re-read after a write rather
 * than patching local state (`useLedger()` re-renders with the new data automatically).
 */
export interface LedgerRepository {
  listAccounts(): Promise<Account[]>;
  /** Adds a new account tab with the standard header row. Names must be unique. */
  createAccount(name: string): Promise<Account>;
  renameAccount(accountId: number, name: string): Promise<void>;
  /**
   * Marks an account as a credit card or loan. Its tab keeps the amounts as they are; Ledger flips
   * their sign wherever it counts the money (see `lib/accounts/inverted.ts`). Saved in `Ledger_Metadata`.
   */
  setAccountInverted(accountId: number, inverted: boolean): Promise<void>;

  /** Transactions in date order (oldest first). */
  listTransactions(accountId: number): Promise<Transaction[]>;
  /** Inserts rows in date order, after any existing rows on the same day. Returns the stored rows. */
  addTransactions(accountId: number, inputs: TransactionInput[]): Promise<Transaction[]>;
  /** Replaces a row; if its date changed, it moves to stay in date order. */
  updateTransaction(accountId: number, row: number, input: TransactionInput): Promise<void>;
  deleteTransaction(accountId: number, row: number): Promise<void>;
  /** Deletes several rows in one step. `rows` are the row numbers as they are now. */
  deleteTransactions(accountId: number, rows: number[]): Promise<void>;

  listCategories(): Promise<Category[]>;
  /** Replaces the whole category list. */
  saveCategories(categories: Category[]): Promise<void>;
  /** Renames a category and rewrites every transaction that used the old name. */
  renameCategory(from: string, to: string): Promise<void>;
  /**
   * Moves every transaction (all accounts) from category `from` to `to`, adding `to` if it is new,
   * and optionally archives `from`. One step, so one save.
   */
  migrateCategory(from: string, to: string, archive?: boolean): Promise<void>;

  /** The paychecks saved in the `Paychecks` tab, or `null` if none were saved yet. */
  getPaychecks(): Promise<JsonValue | null>;
  savePaychecks(config: JsonValue | null): Promise<void>;
}
