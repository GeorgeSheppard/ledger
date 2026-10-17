import type { Account, Category, Transaction, TransactionInput } from '../domain/types';

/**
 * The single seam between the app and wherever the data lives. Features only ever talk to this
 * interface (through `useRepository()`), never to Google APIs directly.
 *
 * Implementations:
 * - `MemoryRepository` (`./memoryRepository.ts`): in-memory, seeded with fixtures. Used in dev and tests.
 * - `GoogleSheetsRepository` (`../google/sheetsRepository.ts`): reads and writes the connected sheet.
 *
 * All methods return fresh copies; callers may mutate results freely. After a mutation, callers
 * should re-read rather than patch local state, because row numbers and totals can shift.
 */
export interface LedgerRepository {
  listAccounts(): Promise<Account[]>;
  /** Adds a new account tab with the standard header row. */
  createAccount(name: string): Promise<Account>;
  renameAccount(accountId: number, name: string): Promise<void>;

  /** Transactions in sheet order (oldest first). */
  listTransactions(accountId: number): Promise<Transaction[]>;
  /** Appends rows in the order given. Returns the stored transactions. */
  addTransactions(accountId: number, inputs: TransactionInput[]): Promise<Transaction[]>;
  updateTransaction(accountId: number, row: number, input: TransactionInput): Promise<void>;
  deleteTransaction(accountId: number, row: number): Promise<void>;

  listCategories(): Promise<Category[]>;
  /** Replaces the whole category list. */
  saveCategories(categories: Category[]): Promise<void>;
  /** Renames a category and rewrites every transaction that used the old name. */
  renameCategory(from: string, to: string): Promise<void>;
}
