import type { LedgerRepository } from '../data/repository';
import type { Account, Category, Transaction, TransactionInput } from '../domain/types';
import { ACCOUNT_COLUMNS, CATEGORIES_TAB, RESERVED_TAB_PREFIX } from '../domain/types';
import {
  categoryRow,
  headerRow,
  rowsToCategories,
  rowsToTransactions,
  transactionRow,
} from './sheetFormat';
import type { SheetsClient } from './sheetsClient';
import type { GridRange, SheetProperties, SheetsRequest } from './sheetsTypes';

/** Fields written for transaction rows: values plus the date format, never the user's styling. */
const TRANSACTION_FIELDS = 'userEnteredValue,userEnteredFormat.numberFormat';
const CATEGORY_COLUMNS = ['Name', 'Color'] as const;
const NEW_TAB_ROWS = 1000;

/** Account tab data: row 2 onwards, columns A–E. */
function accountDataRange(sheetId: number): GridRange {
  return { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: ACCOUNT_COLUMNS.length };
}

function categoryDataRange(sheetId: number): GridRange {
  return {
    sheetId,
    startRowIndex: 1,
    startColumnIndex: 0,
    endColumnIndex: CATEGORY_COLUMNS.length,
  };
}

/** A sheet id for a new tab. The API accepts any non-negative int32 that is not already in use. */
function newSheetId(existing: readonly number[]): number {
  for (;;) {
    const id = Math.floor(Math.random() * 2_000_000_000) + 1;
    if (!existing.includes(id)) return id;
  }
}

/** Requests that add a tab with a bold, frozen header row. */
export function addTabRequests(
  sheetId: number,
  title: string,
  columns: readonly string[]
): SheetsRequest[] {
  return [
    {
      addSheet: {
        properties: {
          sheetId,
          title,
          gridProperties: {
            rowCount: NEW_TAB_ROWS,
            columnCount: columns.length,
            frozenRowCount: 1,
          },
        },
      },
    },
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: [headerRow(columns)],
        fields: 'userEnteredValue,userEnteredFormat.textFormat',
      },
    },
  ];
}

/**
 * `LedgerRepository` backed by a real Google Sheet (see "Sheet format" in docs/ARCHITECTURE.md).
 * Tabs are addressed by their numeric sheet id, so renaming or reordering tabs in Google Sheets
 * while the app is open does not break anything.
 */
export class GoogleSheetsRepository implements LedgerRepository {
  private readonly client: SheetsClient;
  private readonly spreadsheetId: string;

  constructor(client: SheetsClient, spreadsheetId: string) {
    this.client = client;
    this.spreadsheetId = spreadsheetId;
  }

  async listAccounts(): Promise<Account[]> {
    return (await this.sheets())
      .filter((s) => !s.title.startsWith(RESERVED_TAB_PREFIX))
      .sort((a, b) => a.index - b.index)
      .map((s) => ({ id: s.sheetId, name: s.title }));
  }

  async createAccount(name: string): Promise<Account> {
    const title = name.trim();
    if (!title) throw new Error('Account name is required');
    if (title.startsWith(RESERVED_TAB_PREFIX))
      throw new Error(`Account names cannot start with "${RESERVED_TAB_PREFIX}"`);
    const sheets = await this.sheets();
    const sheetId = newSheetId(sheets.map((s) => s.sheetId));
    await this.update(addTabRequests(sheetId, title, ACCOUNT_COLUMNS));
    return { id: sheetId, name: title };
  }

  async renameAccount(accountId: number, name: string): Promise<void> {
    const title = name.trim();
    if (!title) throw new Error('Account name is required');
    await this.update([
      { updateSheetProperties: { properties: { sheetId: accountId, title }, fields: 'title' } },
    ]);
  }

  async listTransactions(accountId: number): Promise<Transaction[]> {
    return rowsToTransactions(accountId, await this.readAccountValues(accountId));
  }

  async addTransactions(accountId: number, inputs: TransactionInput[]): Promise<Transaction[]> {
    if (inputs.length === 0) return [];
    const [sheet, values] = await Promise.all([
      this.sheet(accountId),
      this.readAccountValues(accountId),
    ]);
    // `values` stops at the last non-blank row, so new rows go straight after it.
    const firstRow = 2 + values.length;
    const lastRow = firstRow + inputs.length - 1;
    const rowCount = sheet.gridProperties?.rowCount ?? 0;
    const requests: SheetsRequest[] = [];
    if (lastRow > rowCount)
      requests.push({
        appendDimension: { sheetId: accountId, dimension: 'ROWS', length: lastRow - rowCount },
      });
    requests.push({
      updateCells: {
        start: { sheetId: accountId, rowIndex: firstRow - 1, columnIndex: 0 },
        rows: inputs.map((input, i) => transactionRow(input, firstRow + i)),
        fields: TRANSACTION_FIELDS,
      },
    });
    await this.update(requests);
    return (await this.listTransactions(accountId)).filter((t) => t.row >= firstRow);
  }

  async updateTransaction(accountId: number, row: number, input: TransactionInput): Promise<void> {
    assertDataRow(row);
    // Rewrites the Total formula too, which repairs it if it was edited by hand.
    await this.update([
      {
        updateCells: {
          start: { sheetId: accountId, rowIndex: row - 1, columnIndex: 0 },
          rows: [transactionRow(input, row)],
          fields: TRANSACTION_FIELDS,
        },
      },
    ]);
  }

  async deleteTransaction(accountId: number, row: number): Promise<void> {
    assertDataRow(row);
    await this.update([
      {
        deleteDimension: {
          range: { sheetId: accountId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
        },
      },
    ]);
  }

  async listCategories(): Promise<Category[]> {
    const tab = (await this.sheets()).find((s) => s.title === CATEGORIES_TAB);
    if (!tab) return [];
    const [values = []] = await this.client.readRanges(this.spreadsheetId, [
      categoryDataRange(tab.sheetId),
    ]);
    return rowsToCategories(values);
  }

  async saveCategories(categories: Category[]): Promise<void> {
    const sheets = await this.sheets();
    const requests: SheetsRequest[] = [];
    let tab = sheets.find((s) => s.title === CATEGORIES_TAB);
    if (!tab) {
      const sheetId = newSheetId(sheets.map((s) => s.sheetId));
      requests.push(...addTabRequests(sheetId, CATEGORIES_TAB, CATEGORY_COLUMNS));
      tab = {
        sheetId,
        title: CATEGORIES_TAB,
        index: sheets.length,
        gridProperties: { rowCount: NEW_TAB_ROWS },
      };
    }
    const needed = categories.length + 1;
    const rowCount = tab.gridProperties?.rowCount ?? 0;
    if (needed > rowCount)
      requests.push({
        appendDimension: { sheetId: tab.sheetId, dimension: 'ROWS', length: needed - rowCount },
      });
    // Writing to an open-ended range clears any rows below the new list.
    requests.push({
      updateCells: {
        range: categoryDataRange(tab.sheetId),
        rows: categories.map(categoryRow),
        fields: 'userEnteredValue',
      },
    });
    await this.update(requests);
  }

  async renameCategory(from: string, to: string): Promise<void> {
    if (!from || from === to) return;
    const sheets = await this.sheets();
    const replace = (range: GridRange): SheetsRequest => ({
      findReplace: { find: from, replacement: to, matchCase: true, matchEntireCell: true, range },
    });
    const requests = sheets.flatMap((s): SheetsRequest[] => {
      if (s.title === CATEGORIES_TAB)
        return [
          replace({ sheetId: s.sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }),
        ];
      if (s.title.startsWith(RESERVED_TAB_PREFIX)) return [];
      return [
        replace({ sheetId: s.sheetId, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 }),
      ];
    });
    await this.update(requests);
  }

  private async sheets(): Promise<SheetProperties[]> {
    const metadata = await this.client.getMetadata(this.spreadsheetId);
    return metadata.sheets.map((s) => s.properties);
  }

  private async sheet(sheetId: number): Promise<SheetProperties> {
    const sheet = (await this.sheets()).find((s) => s.sheetId === sheetId);
    if (!sheet) throw new Error(`Unknown account ${sheetId}`);
    return sheet;
  }

  private async readAccountValues(accountId: number): Promise<unknown[][]> {
    const [values = []] = await this.client.readRanges(this.spreadsheetId, [
      accountDataRange(accountId),
    ]);
    return values;
  }

  private update(requests: SheetsRequest[]): Promise<void> {
    return this.client.batchUpdate(this.spreadsheetId, requests);
  }
}

function assertDataRow(row: number) {
  if (!Number.isInteger(row) || row < 2) throw new Error(`Unknown row ${row}`);
}
