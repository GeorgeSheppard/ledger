import { XLSX_MIME } from '../../../lib/files/xlsx';
import type { LedgerData } from '../../../lib/store/ledgerData';
import type { DownloadedFile, Saver } from '../types';
import { writeWorkbook } from './workbook';

/** Characters that file systems reject, replaced so the download always saves. */
function downloadName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Ledger'}.xlsx`;
}

/**
 * Saves a ledger that lives in a file on the user's device. Nothing is uploaded: edits stay in
 * memory (and the browser's IndexedDB), and `download` builds a new `.xlsx` with the changes.
 * `original` is the workbook the ledger was read from (`null` for a new ledger), kept so tabs
 * Ledger does not own are written back untouched; `knownAccountIds` are the accounts read from it.
 */
export function fileSaver(
  title: string,
  knownAccountIds: readonly number[],
  original: ArrayBuffer | null
): Saver {
  return {
    id: 'local-file',
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
