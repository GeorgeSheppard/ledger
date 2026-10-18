import { parseCsv } from '../csv/parse';
import { DEFAULT_ACCOUNT_NAME, DEFAULT_CATEGORIES } from '../google/newSpreadsheet';
import type { LedgerData } from '../store/ledgerData';
import {
  EMPTY_LAYOUT,
  type DownloadedFile,
  type LedgerRemote,
  type RemoteState,
} from '../store/remote';
import { ledgerFromTabs, readWorkbookTabs, writeWorkbook, XLSX_MIME } from './workbook';

/**
 * A ledger that lives in a file on the user's device. Nothing is uploaded: the file is read in the
 * browser, edits stay in memory, and `download` builds a new `.xlsx` with the changes.
 */
export interface OpenedFile {
  /** Shown as the spreadsheet name. */
  title: string;
  remote: LedgerRemote;
}

/** The part of a file name before its extension. */
export function fileTitle(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '').trim() || 'Ledger';
}

/** Characters that file systems reject, replaced so the download always saves. */
function downloadName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Ledger'}.xlsx`;
}

/**
 * `LedgerRemote` for a file. `original` is the workbook it was read from (`null` for a new ledger),
 * kept so tabs Ledger does not own are written back untouched.
 */
export function fileRemote(
  title: string,
  state: RemoteState,
  original: ArrayBuffer | null
): LedgerRemote {
  const knownAccountIds = state.data.accounts.map((account) => account.id);
  return {
    async load() {
      return structuredClone(state);
    },
    // There is nowhere to write to; downloading is what gets changes out of the browser.
    async save(base, next) {
      return { ...base, data: structuredClone(next) };
    },
    async download(data: LedgerData): Promise<DownloadedFile> {
      const bytes = await writeWorkbook(original, knownAccountIds, data);
      return { name: downloadName(title), type: XLSX_MIME, bytes };
    },
  };
}

/** An empty ledger with the starter categories and one account, for people who bring no file. */
export function blankLedger(title = 'Ledger'): OpenedFile {
  const data: LedgerData = {
    accounts: [{ id: 1, name: DEFAULT_ACCOUNT_NAME }],
    rows: { 1: [] },
    categories: structuredClone(DEFAULT_CATEGORIES),
    dashboard: null,
  };
  const layout = { ...EMPTY_LAYOUT, sheetIds: [1] };
  return { title, remote: fileRemote(title, { data, skippedTabs: [], layout }, null) };
}

/**
 * Opens a dropped or chosen file. `.xlsx` files keep all of their tabs. A `.csv` must already be
 * in the account format (`Date,Category,Amount,Note,Total`) and becomes a single account named
 * after the file; bank exports with other columns go in through Import data instead.
 */
export async function openLedgerFile(file: File): Promise<OpenedFile> {
  const title = fileTitle(file.name);
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    const values = parseCsv(await file.text());
    const state = ledgerFromTabs([{ id: 1, title, values }]);
    return { title, remote: fileRemote(title, state, null) };
  }
  if (!/\.xlsx$/i.test(file.name) && file.type !== XLSX_MIME)
    throw new Error(
      'Ledger opens .xlsx and .csv files. Save Numbers or older Excel (.xls) files as .xlsx first.'
    );
  const bytes = await file.arrayBuffer();
  const state = ledgerFromTabs(await readWorkbookTabs(bytes));
  return { title, remote: fileRemote(title, state, bytes) };
}
