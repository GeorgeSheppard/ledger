import type { SpreadsheetRef } from '../domain/types';

/**
 * How the connect page finds a spreadsheet. The Google implementation opens the Drive picker and
 * creates real sheets; the demo implementation hands back the demo ledger.
 */
export interface SpreadsheetSource {
  /** Lets the user choose an existing spreadsheet. Resolves `null` if they cancel. */
  pick(): Promise<SpreadsheetRef | null>;
  /** Creates a new spreadsheet laid out for Ledger, with one account and default categories. */
  create(title: string): Promise<SpreadsheetRef>;
  /** Optional warm-up (loading scripts) so the picker opens instantly when asked. */
  preload?(): void;
}
