import { describe, expect, it } from 'vitest';
import { fakeSheet } from '../../../lib/google/testing';
import type { FakeClient } from '../../../lib/google/testing';
import { googleConnection } from '.';

const open = (client: FakeClient) => googleConnection(client, { id: 'sheet', title: 'Ledger' });

describe('google ingest', () => {
  it('reads the whole spreadsheet in two requests', async () => {
    const client = fakeSheet();
    await open(client).load();
    expect(client.metadataReads).toBe(1);
    expect(client.valueReads).toHaveLength(1);
    // Reserved tabs other than _Metadata, _Categories, _Dashboard and _Paychecks are not read.
    expect(client.valueReads[0]!.map((r) => r.sheetId)).toEqual([10, 20, 30, 40, 99]);
  });

  it('keeps only tabs in the exact format, in tab order', async () => {
    const { data, skippedTabs, layout } = await open(fakeSheet()).load();
    expect(data.accounts).toEqual([
      { id: 10, name: 'Current' },
      { id: 20, name: 'Savings', inverted: true },
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
    expect(layout).toMatchObject({ metadataSheetId: 99, rowCounts: { 20: 3 } });
    expect(layout.sheetIds).toEqual([10, 20, 30, 40, 99, 98]);
  });

  it('still reads categories from an old _Categories tab', async () => {
    const { data, layout } = await open(fakeSheet({ legacy: true })).load();
    expect(data.categories).toEqual([{ name: 'Food', color: '#4f7cff' }]);
    expect(data.accounts.some((a) => a.inverted)).toBe(false);
    expect(layout).toMatchObject({ categoriesSheetId: 99 });
    expect(layout.metadataSheetId).toBeUndefined();
  });
});
