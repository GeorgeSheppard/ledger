import type { CellValue, Worksheet } from 'exceljs';
import { ACCOUNT_COLUMNS } from '../../../lib/domain/types';
import { loadWorkbook } from '../../../lib/files/xlsx';
import { parseSpreadsheet } from '../../../lib/google/parseSpreadsheet';
import type { RemoteState } from '../../../lib/store/remote';

/**
 * Reads a ledger from an `.xlsx` workbook in the same tab layout as the Google Sheet (see "Sheet
 * format" in docs/ARCHITECTURE.md). Reading goes through the same parser as Sheets, so the same
 * strictness applies: a tab is an account only if its header is exactly
 * `Date | Category | Amount | Note | Total` and every row has a valid date and amount.
 */

/** Columns read from each tab: Date to Total, plus one spare to spot extra columns in the header. */
const READ_COLUMNS = ACCOUNT_COLUMNS.length + 1;

/** One tab as plain values, row by row from row 1. */
export interface RawTab {
  id: number;
  title: string;
  values: unknown[][];
}

/** A cell as the plain value the Sheets parser expects: dates as ISO text, formulas as results. */
function plainValue(value: CellValue): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if ('result' in value) return plainValue(value.result as CellValue);
  if ('richText' in value) return value.richText.map((part) => part.text).join('');
  if ('text' in value) return String(value.text);
  return '';
}

function readTab(sheet: Worksheet): RawTab {
  const values: unknown[][] = [];
  for (let row = 1; row <= sheet.rowCount; row++) {
    const cells: unknown[] = [];
    for (let column = 1; column <= READ_COLUMNS; column++)
      cells.push(plainValue(sheet.getCell(row, column).value));
    values.push(cells);
  }
  return { id: sheet.id, title: sheet.name, values };
}

/** Every tab of an `.xlsx` file as plain values. */
export async function readWorkbookTabs(bytes: ArrayBuffer | Uint8Array): Promise<RawTab[]> {
  return (await loadWorkbook(bytes)).worksheets.map(readTab);
}

/**
 * The ledger in a set of tabs. Throws a readable error if nothing in the file is a Ledger account,
 * so a wrong file is explained rather than opened as an empty ledger.
 */
export function ledgerFromTabs(tabs: readonly RawTab[]): RemoteState {
  const state = parseSpreadsheet(
    tabs.map((tab, index) => ({ sheetId: tab.id, title: tab.title, index })),
    new Map(tabs.map((tab) => [tab.id, tab.values]))
  );
  if (state.data.accounts.length === 0) {
    if (tabs.length === 0) throw new Error('That file has no tabs.');
    const reasons = state.skippedTabs
      .slice(0, 3)
      .map((tab) => `“${tab.title}”: ${tab.reason}`)
      .join('; ');
    throw new Error(
      `No tab in that file has ${ACCOUNT_COLUMNS.join(' | ')} as its first row, so Ledger cannot read it as accounts.${reasons ? ` ${reasons}.` : ''}`
    );
  }
  return state;
}
