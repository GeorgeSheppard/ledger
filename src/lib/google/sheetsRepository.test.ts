import { describe, expect, it } from 'vitest';
import type { SheetsClient } from './sheetsClient';
import { GoogleSheetsRepository } from './sheetsRepository';
import type { GridRange, NewSpreadsheet, SheetProperties, SheetsRequest } from './sheetsTypes';

/** Records requests and serves canned metadata and values. */
class FakeClient implements SheetsClient {
  updates: SheetsRequest[][] = [];
  reads: GridRange[] = [];
  sheets: SheetProperties[];
  values: Record<number, unknown[][]>;

  constructor(sheets: SheetProperties[], values: Record<number, unknown[][]> = {}) {
    this.sheets = sheets;
    this.values = values;
  }

  async getMetadata(spreadsheetId: string) {
    return {
      spreadsheetId,
      properties: { title: 'Ledger' },
      sheets: this.sheets.map((properties) => ({ properties })),
    };
  }

  async readRanges(_id: string, ranges: GridRange[]) {
    this.reads.push(...ranges);
    return ranges.map((r) => this.values[r.sheetId] ?? []);
  }

  async batchUpdate(_id: string, requests: SheetsRequest[]) {
    this.updates.push(requests);
  }

  async create(_body: NewSpreadsheet): Promise<{ spreadsheetId: string; title: string }> {
    throw new Error('not used');
  }
}

const sheets: SheetProperties[] = [
  { sheetId: 20, title: 'Savings', index: 1, gridProperties: { rowCount: 3 } },
  { sheetId: 10, title: 'Current', index: 0, gridProperties: { rowCount: 1000 } },
  { sheetId: 99, title: '_Categories', index: 2, gridProperties: { rowCount: 2 } },
];

describe('GoogleSheetsRepository', () => {
  it('lists account tabs in tab order, hiding reserved tabs', async () => {
    const repo = new GoogleSheetsRepository(new FakeClient(sheets), 'sheet');
    expect(await repo.listAccounts()).toEqual([
      { id: 10, name: 'Current' },
      { id: 20, name: 'Savings' },
    ]);
  });

  it('reads transactions by sheet id from row 2', async () => {
    const client = new FakeClient(sheets, { 10: [[46113, 'Pay', 100, 'x', 100]] });
    const repo = new GoogleSheetsRepository(client, 'sheet');
    const [t] = await repo.listTransactions(10);
    expect(t).toMatchObject({ row: 2, date: '2026-04-01', amount: 100, total: 100 });
    expect(client.reads[0]).toEqual({
      sheetId: 10,
      startRowIndex: 1,
      startColumnIndex: 0,
      endColumnIndex: 5,
    });
  });

  it('appends after the last row, growing the grid when needed', async () => {
    const client = new FakeClient(sheets, {
      20: [
        [46113, '', 1, '', 1],
        [46113, '', 2, '', 3],
      ],
    });
    const repo = new GoogleSheetsRepository(client, 'sheet');
    await repo.addTransactions(20, [
      { date: '2026-04-02', category: '', amount: 5, note: '' },
      { date: '2026-04-03', category: '', amount: 6, note: '' },
    ]);
    const [requests] = client.updates;
    // Rows 2–3 hold data, so new rows are 4 and 5; the grid has 3 rows, so 2 are added.
    expect(requests?.[0]).toEqual({
      appendDimension: { sheetId: 20, dimension: 'ROWS', length: 2 },
    });
    const update = requests?.[1];
    expect(update && 'updateCells' in update && update.updateCells.start).toEqual({
      sheetId: 20,
      rowIndex: 3,
      columnIndex: 0,
    });
    const formulas =
      update && 'updateCells' in update
        ? update.updateCells.rows.map((r) => r.values[4]?.userEnteredValue?.formulaValue)
        : [];
    expect(formulas).toEqual(['=SUM($C$2:C4)', '=SUM($C$2:C5)']);
  });

  it('updates and deletes by row', async () => {
    const client = new FakeClient(sheets);
    const repo = new GoogleSheetsRepository(client, 'sheet');
    await repo.updateTransaction(10, 5, { date: '2026-04-01', category: 'A', amount: 1, note: '' });
    await repo.deleteTransaction(10, 5);
    expect(client.updates[0]?.[0]).toMatchObject({
      updateCells: { start: { sheetId: 10, rowIndex: 4, columnIndex: 0 } },
    });
    expect(client.updates[1]?.[0]).toEqual({
      deleteDimension: { range: { sheetId: 10, dimension: 'ROWS', startIndex: 4, endIndex: 5 } },
    });
    await expect(repo.deleteTransaction(10, 1)).rejects.toThrow('Unknown row 1');
  });

  it('creates accounts with a header row and rejects reserved names', async () => {
    const client = new FakeClient(sheets);
    const repo = new GoogleSheetsRepository(client, 'sheet');
    const account = await repo.createAccount('  Credit card ');
    expect(account.name).toBe('Credit card');
    expect(client.updates[0]?.[0]).toMatchObject({
      addSheet: { properties: { sheetId: account.id, title: 'Credit card' } },
    });
    await expect(repo.createAccount('_Secret')).rejects.toThrow();
  });

  it('reads categories, and returns none when the tab is missing', async () => {
    const client = new FakeClient(sheets, { 99: [['Rent', '#d9534f']] });
    expect(await new GoogleSheetsRepository(client, 's').listCategories()).toEqual([
      { name: 'Rent', color: '#d9534f' },
    ]);
    const without = new FakeClient(sheets.filter((s) => s.sheetId !== 99));
    expect(await new GoogleSheetsRepository(without, 's').listCategories()).toEqual([]);
  });

  it('saves categories over the whole list, creating the tab if needed', async () => {
    const client = new FakeClient(sheets);
    await new GoogleSheetsRepository(client, 's').saveCategories([
      { name: 'A', color: '#000000' },
      { name: 'B', color: '#111111' },
    ]);
    const requests = client.updates[0] ?? [];
    expect(requests[0]).toEqual({ appendDimension: { sheetId: 99, dimension: 'ROWS', length: 1 } });
    expect(requests[1]).toMatchObject({
      updateCells: { range: { sheetId: 99, startRowIndex: 1 }, fields: 'userEnteredValue' },
    });

    const without = new FakeClient(sheets.filter((s) => s.sheetId !== 99));
    await new GoogleSheetsRepository(without, 's').saveCategories([]);
    expect(without.updates[0]?.[0]).toMatchObject({
      addSheet: { properties: { title: '_Categories' } },
    });
  });

  it('renames a category in the list and in every account', async () => {
    const client = new FakeClient(sheets);
    await new GoogleSheetsRepository(client, 's').renameCategory('Food', 'Groceries');
    const ranges = (client.updates[0] ?? []).map((r) =>
      'findReplace' in r ? r.findReplace.range : null
    );
    expect(ranges).toEqual([
      { sheetId: 20, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
      { sheetId: 10, startRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
      { sheetId: 99, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
    ]);
  });
});
