import { EMPTY_LAYOUT } from '../../../lib/store/remote';
import { exampleData } from './data';
import { fileConnection } from '../shared/fileConnection';
import type { Connection } from '../types';

/**
 * A ready-made ledger to explore the app with before setting up real data: two accounts, categories
 * and six months of paychecks. It lives in memory, so nothing is signed in, uploaded or stored, and
 * Download turns it into a spreadsheet that shows the layout Ledger expects.
 */
export function exampleLedger(): Connection {
  const data = exampleData();
  const layout = { ...EMPTY_LAYOUT, sheetIds: data.accounts.map((account) => account.id) };
  return fileConnection('Example ledger', { data, skippedTabs: [], tabReports: [], layout }, null);
}
