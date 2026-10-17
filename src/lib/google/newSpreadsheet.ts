import type { Category, SpreadsheetRef } from '../domain/types';
import { ACCOUNT_COLUMNS, CATEGORIES_TAB } from '../domain/types';
import { categoryRow, headerRow } from './sheetFormat';
import type { SheetsClient } from './sheetsClient';
import type { NewSpreadsheet } from './sheetsTypes';

/** Categories a brand new ledger starts with. Users can rename, recolour or delete them. */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Income', color: '#2f9e6b' },
  { name: 'Housing', color: '#d9534f' },
  { name: 'Bills', color: '#c2577f' },
  { name: 'Groceries', color: '#4f7cff' },
  { name: 'Eating out', color: '#e8913a' },
  { name: 'Transport', color: '#8e6bd6' },
  { name: 'Shopping', color: '#d4a72c' },
  { name: 'Health', color: '#3aa6b9' },
  { name: 'Entertainment', color: '#b55fc4' },
  { name: 'Transfers', color: '#8b8d98' },
];

export const DEFAULT_ACCOUNT_NAME = 'Current account';
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
