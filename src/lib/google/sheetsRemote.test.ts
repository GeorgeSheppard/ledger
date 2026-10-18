import { describe, expect, it } from 'vitest';
import type { LedgerData } from '../store/ledgerData';
import type { SheetsClient } from './sheetsClient';
import { DASHBOARD_TAB, saveRequests, sheetsRemote } from './sheetsRemote';
import type { GridRange, NewSpreadsheet, SheetProperties, SheetsRequest } from './sheetsTypes';

const HEADER = ['Date', 'Category', 'Amount', 'Note', 'Total'];

/** Counts requests and serves canned metadata and values. */
class FakeClient implements SheetsClient {
  metadataReads = 0;
  valueReads: GridRange[][] = [];
  updates: SheetsRequest[][] = [];

  constructor(
    readonly sheets: SheetProperties[],
    readonly values: Record<number, unknown[][]>
  ) {}

  async getMetadata(spreadsheetId: string) {
    this.metadataReads++;
    return {
      spreadsheetId,
      properties: { title: 'Ledger' },
      sheets: this.sheets.map((properties) => ({ properties })),
    };
  }

  async readRanges(_id: string, ranges: GridRange[]) {
    this.valueReads.push(ranges);
    return ranges.map((r) => this.values[r.sheetId] ?? []);
  }

  async batchUpdate(_id: string, requests: SheetsRequest[]) {
    this.updates.push(requests);
  }

  async create(_body: NewSpreadsheet): Promise<{ spreadsheetId: string; title: string }> {
    throw new Error('not used');
  }
}

const tab = (sheetId: number, title: string, index: number, rowCount = 1000): SheetProperties => ({
  sheetId,
  title,
  index,
  gridProperties: { rowCount },
});

function fakeSheet() {
  return new FakeClient(
    [
      tab(20, 'Savings', 1, 3),
      tab(10, 'Current', 0),
      tab(30, 'Budget', 2),
      tab(40, 'Notes', 3),
      tab(99, '_Categories', 4),
      tab(98, '_Other', 5),
    ],
    {
      10: [HEADER, [46113, 'Salary', 1000, 'Pay', 1000], [], [46114, 'Food', -20, '', 980]],
      20: [HEADER, [46113, '', 500, 'Opening', 500]],
      30: [
        ['Month', 'Category', 'Budget'],
        ['Jan', 'Food', 200],
      ],
      40: [HEADER, ['Opening balance', '', 100, '', 100]],
      99: [
        ['Name', 'Color'],
        ['Food', '#4f7cff'],
      ],
    }
  );
}

describe('sheetsRemote.load', () => {
  it('reads the whole spreadsheet in two requests', async () => {
    const client = fakeSheet();
    await sheetsRemote(client, 'sheet').load();
    expect(client.metadataReads).toBe(1);
    expect(client.valueReads).toHaveLength(1);
    // Reserved tabs other than _Categories and _Dashboard are not read.
    expect(client.valueReads[0]!.map((r) => r.sheetId)).toEqual([10, 20, 30, 40, 99]);
  });

  it('keeps only tabs in the exact format, in tab order', async () => {
    const { data, skippedTabs, layout } = await sheetsRemote(fakeSheet(), 'sheet').load();
    expect(data.accounts).toEqual([
      { id: 10, name: 'Current' },
      { id: 20, name: 'Savings' },
    ]);
    expect(data.rows[10]).toEqual([
      { date: '2026-04-01', category: 'Salary', amount: 1000, note: 'Pay' },
      { date: '2026-04-02', category: 'Food', amount: -20, note: '' },
    ]);
    expect(skippedTabs).toEqual([
      { title: 'Budget', reason: 'Row 1 is not Date | Category | Amount | Note | Total' },
      { title: 'Notes', reason: 'Row 2 has no valid date' },
    ]);
    expect(data.categories).toEqual([{ name: 'Food', color: '#4f7cff' }]);
    expect(data.dashboard).toBeNull();
    expect(layout).toMatchObject({ categoriesSheetId: 99, rowCounts: { 20: 3 } });
    expect(layout.sheetIds).toEqual([10, 20, 30, 40, 99, 98]);
  });
});

describe('saveRequests', () => {
  async function loaded() {
    return sheetsRemote(fakeSheet(), 'sheet').load();
  }

  it('sends nothing when nothing changed', async () => {
    const base = await loaded();
    expect(saveRequests(base, base.data).requests).toEqual([]);
  });

  it('rewrites only changed account tabs, in date order with fresh totals, growing the grid', async () => {
    const base = await loaded();
    const next: LedgerData = {
      ...base.data,
      rows: {
        ...base.data.rows,
        20: [
          { date: '2026-03-01', category: '', amount: 1, note: 'older' },
          ...base.data.rows[20]!,
          { date: '2026-05-01', category: '', amount: 2, note: '' },
        ],
      },
    };
    const { requests, layout } = saveRequests(base, next);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({ appendDimension: { sheetId: 20, dimension: 'ROWS', length: 1 } });
    const write = requests[1] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.range).toEqual({
      sheetId: 20,
      startRowIndex: 1,
      startColumnIndex: 0,
      endColumnIndex: 5,
    });
    expect(write.updateCells.rows.map((r) => r.values[4]?.userEnteredValue)).toEqual([
      { formulaValue: '=SUM($C$2:C2)' },
      { formulaValue: '=SUM($C$2:C3)' },
      { formulaValue: '=SUM($C$2:C4)' },
    ]);
    expect(write.updateCells.rows[0]!.values[3]?.userEnteredValue).toEqual({
      stringValue: 'older',
    });
    expect(layout.rowCounts[20]).toBe(4);
  });

  it('clears rows left over after a delete', async () => {
    const base = await loaded();
    const next = { ...base.data, rows: { ...base.data.rows, 10: base.data.rows[10]!.slice(1) } };
    const [request] = saveRequests(base, next).requests;
    const write = request as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.rows).toHaveLength(1);
    expect(write.updateCells.range?.endRowIndex).toBeUndefined();
  });

  it('adds new accounts, renames, categories and the dashboard tab in one batch', async () => {
    const base = await loaded();
    const next: LedgerData = {
      accounts: [
        { id: 10, name: 'Main' },
        { id: 20, name: 'Savings' },
        { id: 555, name: 'Credit card' },
      ],
      rows: {
        ...base.data.rows,
        555: [{ date: '2026-04-01', category: '', amount: -5, note: '' }],
      },
      categories: [{ name: 'Groceries', color: '#4f7cff' }],
      dashboard: { widgets: ['netWorth'] },
    };
    const { requests, layout } = saveRequests(base, next);
    const kinds = requests.map((r) => Object.keys(r)[0]);
    expect(kinds).toEqual([
      'updateSheetProperties',
      'addSheet',
      'updateCells',
      'updateCells',
      'updateCells',
      'addSheet',
      'updateCells',
      'updateCells',
    ]);
    expect(requests[1]).toMatchObject({
      addSheet: { properties: { sheetId: 555, title: 'Credit card' } },
    });
    expect(requests[5]).toMatchObject({ addSheet: { properties: { title: DASHBOARD_TAB } } });
    const dashboard = requests[7] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(dashboard.updateCells.rows[0]!.values[0]?.userEnteredValue).toEqual({
      stringValue: '{"widgets":["netWorth"]}',
    });
    expect(layout.dashboardSheetId).toBeDefined();
    expect(layout.sheetIds).toContain(555);
  });

  it('creates the categories tab when the sheet has none', async () => {
    const client = new FakeClient([tab(10, 'Current', 0)], { 10: [HEADER] });
    const remote = sheetsRemote(client, 'sheet');
    const base = await remote.load();
    const saved = await remote.save(base, {
      ...base.data,
      categories: [{ name: 'Food', color: '#4f7cff' }],
    });
    expect(client.updates).toHaveLength(1);
    expect(client.updates[0]![0]).toMatchObject({
      addSheet: { properties: { title: '_Categories' } },
    });
    expect(saved.layout.categoriesSheetId).toBeDefined();
    expect(saved.data.categories).toHaveLength(1);
  });
});
