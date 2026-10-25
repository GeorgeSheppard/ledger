import { describe, expect, it } from 'vitest';
import { FakeClient, HEADER, fakeSheet, tab } from '../../../lib/google/testing';

import { googleConnection } from '.';

const open = (client: FakeClient) => googleConnection(client, { id: 'sheet', title: 'Ledger' });

describe('google ingest', () => {
  it('reads the whole spreadsheet in two requests', async () => {
    const client = fakeSheet();
    await open(client).load();
    expect(client.metadataReads).toBe(1);
    expect(client.valueReads).toHaveLength(1);
    // Reserved tabs other than Ledger_Metadata, _Categories, Ledger_Dashboard and Paychecks are not read.
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
      {
        title: 'Budget',
        reason:
          'Row 1 is not Date | Category | Amount | Note | Total (it is Month | Category | Budget)',
      },
      { title: 'Notes', reason: 'Row 2 has no valid date' },
    ]);
    expect(data.categories).toEqual([{ name: 'Food', color: '#4f7cff' }]);
    expect(layout).toMatchObject({ metadataSheetId: 99, rowCounts: { 20: 3 } });
    expect(layout.sheetIds).toEqual([10, 20, 30, 40, 99, 98]);
  });

  it('reports what became of every tab, with the reason', async () => {
    const { tabReports } = await open(fakeSheet()).load();
    expect(tabReports.map((t) => [t.title, t.kind, t.imported])).toEqual([
      ['Current', 'account', true],
      ['Savings', 'account', true],
      ['Budget', 'account', false],
      ['Notes', 'account', false],
      ['Ledger_Metadata', 'settings', true],
      ['_Other', 'reserved', false],
    ]);
    expect(tabReports[0]!.reason).toBe('Account with 2 transactions.');
    expect(tabReports[2]!.reason).toMatch(/Row 1 is not/);
    expect(tabReports[5]!.reason).toMatch(/Rename it/);
  });

  it('still reads categories from an old _Categories tab', async () => {
    const { data, layout } = await open(fakeSheet({ legacy: true })).load();
    expect(data.categories).toEqual([{ name: 'Food', color: '#4f7cff' }]);
    expect(data.accounts.some((a) => a.inverted)).toBe(false);
    expect(layout).toMatchObject({ categoriesSheetId: 99 });
    expect(layout.metadataSheetId).toBeUndefined();
  });

  it('reads app tabs under their old names and plans to rename them', async () => {
    const client = new FakeClient(
      [tab(10, 'Current', 0), tab(31, '_Paychecks', 1), tab(32, '_Metadata', 2)],
      { 10: [HEADER], 31: [['Date', 'Tax code', 'Type', 'Name', 'Amount']] }
    );
    const { data, layout } = await open(client).load();
    expect(data.accounts.map((a) => a.name)).toEqual(['Current']);
    expect(layout).toMatchObject({
      paychecksSheetId: 31,
      metadataSheetId: 32,
      renames: { 31: 'Paychecks', 32: 'Ledger_Metadata' },
    });
  });

  it('prefers the new tab when both names exist, and leaves the old one alone', async () => {
    const client = new FakeClient(
      [tab(10, 'Current', 0), tab(31, '_Paychecks', 1), tab(30, 'Paychecks', 2)],
      {
        10: [HEADER],
      }
    );
    const { layout } = await open(client).load();
    expect(layout.paychecksSheetId).toBe(30);
    expect(layout.renames).toBeUndefined();
    expect(client.valueReads[0]!.map((r) => r.sheetId)).toEqual([10, 30]);
  });
});
