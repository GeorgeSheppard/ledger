/**
 * Core domain types shared by every feature. These describe the data as the app sees it, independent
 * of how it is stored. Plain data only: no classes, no functions. The types are inferred from the
 * schemas in `./schemas.ts`, which is where their fields are documented.
 */

import type { z } from 'zod';
import type {
  accountSchema,
  categorySchema,
  spreadsheetRefSchema,
  transactionInputSchema,
  transactionSchema,
} from './schemas';

/** ISO calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type Category = z.infer<typeof categorySchema>;
export type SpreadsheetRef = z.infer<typeof spreadsheetRefSchema>;

/** Column order of every account tab. */
export const ACCOUNT_COLUMNS = ['Date', 'Category', 'Amount', 'Note', 'Total'] as const;

/** Tabs starting with this prefix are app metadata, never accounts. */
export const RESERVED_TAB_PREFIX = '_';

/**
 * Tab that holds the settings the app keeps about the spreadsheet: the categories and per-account
 * options such as `inverted` (columns: Type, Name, Setting, Value).
 */
export const METADATA_TAB = '_Metadata';

/** The old category tab (columns: Name, Color). Still read; replaced by `_Metadata` on the next save. */
export const CATEGORIES_TAB = '_Categories';

/** Tab that holds the paychecks, as JSON in cell A2. */
export const PAYCHECKS_TAB = '_Paychecks';
/** Tab holding the dashboard layout as JSON in cell A2. */
export const DASHBOARD_TAB = '_Dashboard';
