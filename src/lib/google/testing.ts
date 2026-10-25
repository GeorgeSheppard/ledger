/** A fake `SheetsClient` and sample tabs for tests. */
import type { SheetsClient } from './sheetsClient';
import type { GridRange, NewSpreadsheet, SheetProperties, SheetsRequest } from './sheetsTypes';

export const HEADER = ['Date', 'Category', 'Amount', 'Note', 'Total'];

/** Counts requests and serves canned metadata and values. */
export class FakeClient implements SheetsClient {
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

export const tab = (
  sheetId: number,
  title: string,
  index: number,
  rowCount = 1000
): SheetProperties => ({
  sheetId,
  title,
  index,
  gridProperties: { rowCount },
});

/** A spreadsheet with a `Ledger_Metadata` tab (id 99), or the old `_Categories` tab when `legacy`. */
export function fakeSheet({ legacy = false } = {}) {
  return new FakeClient(
    [
      tab(20, 'Savings', 1, 3),
      tab(10, 'Current', 0),
      tab(30, 'Budget', 2),
      tab(40, 'Notes', 3),
      tab(99, legacy ? '_Categories' : 'Ledger_Metadata', 4),
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
      99: legacy
        ? [
            ['Name', 'Color'],
            ['Food', '#4f7cff'],
          ]
        : [
            ['Type', 'Name', 'Setting', 'Value'],
            ['category', 'Food', 'color', '#4f7cff'],
            ['account', 'Savings', 'inverted', true],
            ['account', 'Current', 'inverted', 'FALSE'],
            ['account', 'Gone', 'inverted', true],
            ['theme', 'x', 'y', 'z'],
          ],
    }
  );
}
