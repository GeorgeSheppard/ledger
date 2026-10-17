/**
 * Core domain types shared by every feature. These describe the data as the app sees it, independent
 * of how it is stored. Plain data only: no classes, no functions.
 */

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** One tab in the spreadsheet. Every tab whose name does not start with `_` is an account. */
export interface Account {
  /** The tab's numeric sheet id. Stable across renames and reordering. */
  id: number;
  name: string;
}

/** One row in an account tab: Date, Category, Amount, Note, Total. */
export interface Transaction {
  /** Unique within the spreadsheet: `${accountId}:${row}`. Changes if rows are inserted above. */
  id: string;
  accountId: number;
  /** 1-based spreadsheet row number (row 1 is the header). */
  row: number;
  date: IsoDate;
  /** Category name, matching a `Category.name`. Empty string when uncategorised. */
  category: string;
  /** Positive for money in, negative for money out. */
  amount: number;
  note: string;
  /** Running balance after this transaction. Computed by the sheet; read-only. */
  total: number;
}

/** The fields a caller supplies when adding or editing a transaction. */
export type TransactionInput = Pick<Transaction, 'date' | 'category' | 'amount' | 'note'>;

export interface Category {
  name: string;
  /** Hex colour used in charts and chips, e.g. `#4f7cff`. */
  color: string;
}

/** The spreadsheet the user has connected. */
export interface SpreadsheetRef {
  id: string;
  title: string;
}

/** Column order of every account tab. */
export const ACCOUNT_COLUMNS = ['Date', 'Category', 'Amount', 'Note', 'Total'] as const;

/** Tabs starting with this prefix are app metadata, never accounts. */
export const RESERVED_TAB_PREFIX = '_';

/** Tab that holds the category list (columns: Name, Color). */
export const CATEGORIES_TAB = '_Categories';
