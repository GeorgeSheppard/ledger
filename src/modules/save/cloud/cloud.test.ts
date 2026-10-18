import { describe, expect, it } from 'vitest';
import { DASHBOARD_TAB } from '../../../lib/domain/types';
import type { SheetsRequest } from '../../../lib/google/sheetsTypes';
import { fakeSheet, HEADER, tab, FakeClient } from '../../../lib/google/testing';
import type { LedgerData } from '../../../lib/store/ledgerData';
import { googleConnection } from '../../ingest';
import { saveRequests } from './requests';

describe('saveRequests', () => {
  async function loaded() {
    return googleConnection(fakeSheet(), { id: 'sheet', title: 'Ledger' }).load();
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
      paychecks: null,
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

  it('reads and writes the _Paychecks tab', async () => {
    const client = new FakeClient([tab(10, 'Current', 0), tab(30, '_Paychecks', 1)], {
      10: [HEADER],
      30: [['Paychecks'], ['{"paychecks":[]}']],
    });
    const base = await googleConnection(client, { id: 'sheet', title: 'Ledger' }).load();
    expect(base.data.paychecks).toEqual({ paychecks: [] });
    expect(base.layout.paychecksSheetId).toBe(30);
    expect(base.data.accounts.map((a) => a.name)).toEqual(['Current']);

    const next: LedgerData = { ...base.data, paychecks: { paychecks: [{ id: 'a' }] } };
    const { requests } = saveRequests(base, next);
    expect(requests).toHaveLength(1);
    const write = requests[0] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.range?.sheetId).toBe(30);
    expect(write.updateCells.rows[0]!.values[0]?.userEnteredValue).toEqual({
      stringValue: '{"paychecks":[{"id":"a"}]}',
    });
  });

  it('adds the _Paychecks tab the first time paychecks are saved', async () => {
    const base = await loaded();
    const { requests, layout } = saveRequests(base, { ...base.data, paychecks: { paychecks: [] } });
    expect(requests.map((r) => Object.keys(r)[0])).toEqual([
      'addSheet',
      'updateCells',
      'updateCells',
    ]);
    expect(requests[0]).toMatchObject({ addSheet: { properties: { title: '_Paychecks' } } });
    expect(layout.paychecksSheetId).toBeDefined();
  });

  it('creates the categories tab when the sheet has none', async () => {
    const client = new FakeClient([tab(10, 'Current', 0)], { 10: [HEADER] });
    const connection = googleConnection(client, { id: 'sheet', title: 'Ledger' });
    const base = await connection.load();
    const saved = await connection.saver.save(base, {
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
