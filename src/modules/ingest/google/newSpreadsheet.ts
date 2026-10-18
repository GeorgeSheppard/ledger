import type { Category, SpreadsheetRef } from '../../../lib/domain/types';
import { DEFAULT_ACCOUNT_NAME, DEFAULT_CATEGORIES } from '../../../lib/domain/defaults';
import { ACCOUNT_COLUMNS, CATEGORIES_TAB } from '../../../lib/domain/types';
import { categoryRow, headerRow } from '../../../lib/google/sheetFormat';
import type { SheetsClient } from '../../../lib/google/sheetsClient';
import type { NewSpreadsheet } from '../../../lib/google/sheetsTypes';

export const DEFAULT_SPREADSHEET_TITLE = 'Ledger';

/** Body for `spreadsheets.create`: one empty account tab and a `_Categories` tab. */
export function newSpreadsheetBody(
  title: string,
  accountName = DEFAULT_ACCOUNT_NAME,
  categories: readonly Category[] = DEFAULT_CATEGORIES
): NewSpreadsheet {
  return {
    properties: { title },
    sheets: [
      {
        properties: {
          title: accountName,
          index: 0,
          gridProperties: {
            rowCount: 1000,
            columnCount: ACCOUNT_COLUMNS.length,
            frozenRowCount: 1,
          },
        },
        data: [{ startRow: 0, startColumn: 0, rowData: [headerRow(ACCOUNT_COLUMNS)] }],
      },
      {
        properties: {
          title: CATEGORIES_TAB,
          index: 1,
          gridProperties: { rowCount: 200, columnCount: 2, frozenRowCount: 1 },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [headerRow(['Name', 'Color']), ...categories.map(categoryRow)],
          },
        ],
      },
    ],
  };
}

/** Creates a new ledger spreadsheet in the user's Drive. */
export async function createLedgerSpreadsheet(
  client: SheetsClient,
  title = DEFAULT_SPREADSHEET_TITLE
): Promise<SpreadsheetRef> {
  const created = await client.create(
    newSpreadsheetBody(title.trim() || DEFAULT_SPREADSHEET_TITLE)
  );
  return { id: created.spreadsheetId, title: created.title };
}

/** Confirms the signed-in user can open a spreadsheet, and returns its current title. */
export async function openSpreadsheet(client: SheetsClient, id: string): Promise<SpreadsheetRef> {
  const metadata = await client.getMetadata(id);
  return { id: metadata.spreadsheetId, title: metadata.properties.title };
}
