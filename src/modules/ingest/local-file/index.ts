import { parseCsv } from '../../../lib/csv/parse';
import { XLSX_MIME } from '../../../lib/files/xlsx';
import { DEFAULT_ACCOUNT_NAME, DEFAULT_CATEGORIES } from '../../../lib/domain/defaults';
import type { LedgerData } from '../../../lib/store/ledgerData';
import { EMPTY_LAYOUT, type RemoteState } from '../../../lib/store/remote';
import { fileSaver } from '../../save';
import type { Connection, Ingest } from '../types';
import { ledgerFromTabs, readWorkbookTabs } from './workbook';

/** The part of a file name before its extension. */
export function fileTitle(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '').trim() || 'Ledger';
}

/** A ledger held in memory from `state`, saved by downloading a file. */
function fileConnection(
  title: string,
  state: RemoteState,
  original: ArrayBuffer | null
): Connection {
  return {
    title,
    load: async () => structuredClone(state),
    saver: fileSaver(
      title,
      state.data.accounts.map((account) => account.id),
      original
    ),
  };
}

/** An empty ledger with the starter categories and one account, for people who bring no file. */
export function newLocalLedger(title = 'Ledger'): Connection {
  const data: LedgerData = {
    accounts: [{ id: 1, name: DEFAULT_ACCOUNT_NAME }],
    rows: { 1: [] },
    categories: structuredClone(DEFAULT_CATEGORIES),
    paychecks: null,
  };
  const layout = { ...EMPTY_LAYOUT, sheetIds: [1] };
  return fileConnection(title, { data, skippedTabs: [], layout }, null);
}

/**
 * Opens a dropped or chosen file. `.xlsx` files keep all of their tabs. A `.csv` must already be
 * in the account format (`Date,Category,Amount,Note,Total`) and becomes a single account named
 * after the file; bank exports with other columns go in through Import data instead.
 */
export const localFileIngest: Ingest<File> = {
  id: 'local-file',
  label: 'File on this device',
  async open(file) {
    const title = fileTitle(file.name);
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
      const values = parseCsv(await file.text());
      return fileConnection(title, ledgerFromTabs([{ id: 1, title, values }]), null);
    }
    if (!/\.xlsx$/i.test(file.name) && file.type !== XLSX_MIME)
      throw new Error(
        'Ledger opens .xlsx and .csv files. Save Numbers or older Excel (.xls) files as .xlsx first.'
      );
    const bytes = await file.arrayBuffer();
    return fileConnection(title, ledgerFromTabs(await readWorkbookTabs(bytes)), bytes);
  },
};
