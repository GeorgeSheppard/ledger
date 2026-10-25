import { describe, expect, it } from 'vitest';
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

  it('adds new accounts, renames, and categories in one batch', async () => {
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
    ]);
    expect(requests[1]).toMatchObject({
      addSheet: { properties: { sheetId: 555, title: 'Credit card' } },
    });
    expect(layout.sheetIds).toContain(555);
  });

  const PAYCHECK_HEADER = ['Date', 'Tax code', 'Type', 'Name', 'Amount'];
  const PAY = {
    version: 3,
    paychecks: [
      {
        id: 'p1',
        date: '2026-01-25',
        income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
        benefits: [],
        deductions: [{ id: 'l1', name: 'Tax', amount: 600 }],
      },
    ],
  };

  it('reads the _Paychecks table and rewrites it whole when the paychecks change', async () => {
    const client = new FakeClient([tab(10, 'Current', 0), tab(30, 'Paychecks', 1)], {
      10: [HEADER],
      30: [
        PAYCHECK_HEADER,
        ['2026-01-25', '', 'Income', 'Salary', 3000],
        ['2026-01-25', '', 'Deduction', 'Tax', 600],
      ],
    });
    const base = await googleConnection(client, { id: 'sheet', title: 'Ledger' }).load();
    expect(base.data.paychecks).toEqual(PAY);
    expect(base.layout.paychecksSheetId).toBe(30);
    expect(base.layout.paychecksLegacy).toBeUndefined();
    expect(saveRequests(base, base.data).requests).toEqual([]);

    const next: LedgerData = {
      ...base.data,
      paychecks: { ...PAY, paychecks: [{ ...PAY.paychecks[0]!, deductions: [] }] },
    };
    const { requests } = saveRequests(base, next);
    expect(requests).toHaveLength(1);
    const write = requests[0] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.range).toMatchObject({
      sheetId: 30,
      startRowIndex: 0,
      endColumnIndex: 5,
    });
    expect(write.updateCells.range?.endRowIndex).toBeUndefined();
    // Header and the one income line; the old deduction row below is cleared by the open range.
    expect(write.updateCells.rows).toHaveLength(2);
    expect(write.updateCells.rows[1]!.values.map((v) => v.userEnteredValue)).toEqual([
      expect.objectContaining({ numberValue: expect.any(Number) }),
      { stringValue: '' },
      { stringValue: 'Income' },
      { stringValue: 'Salary' },
      { numberValue: 3000 },
    ]);
  });

  it('renames a tab with an old app name on the first save of a change', async () => {
    const client = new FakeClient([tab(10, 'Current', 0), tab(30, '_Paychecks', 1)], {
      10: [HEADER],
      30: [PAYCHECK_HEADER, ['2026-01-25', '', 'Income', 'Salary', 3000]],
    });
    const base = await googleConnection(client, { id: 'sheet', title: 'Ledger' }).load();
    expect(saveRequests(base, base.data).requests).toEqual([]);
    const next: LedgerData = { ...base.data, paychecks: { ...PAY, paychecks: [] } };
    const { requests, layout } = saveRequests(base, next);
    expect(requests[0]).toEqual({
      updateSheetProperties: { properties: { sheetId: 30, title: 'Paychecks' }, fields: 'title' },
    });
    expect(layout.renames).toBeUndefined();
  });

  it('reads the old JSON _Paychecks tab, and replaces it with the table on the next change', async () => {
    const client = new FakeClient([tab(10, 'Current', 0), tab(30, 'Paychecks', 1)], {
      10: [HEADER],
      30: [['Paychecks'], [JSON.stringify(PAY)]],
    });
    const base = await googleConnection(client, { id: 'sheet', title: 'Ledger' }).load();
    expect(base.data.paychecks).toEqual(PAY);
    expect(base.layout.paychecksLegacy).toBe(true);
    expect(saveRequests(base, base.data).requests).toEqual([]);

    const next: LedgerData = {
      ...base.data,
      paychecks: { ...PAY, paychecks: [{ ...PAY.paychecks[0]!, id: 'p9', date: '2026-02-25' }] },
    };
    const { requests, layout } = saveRequests(base, next);
    expect(requests[0]).toEqual({
      appendDimension: { sheetId: 30, dimension: 'COLUMNS', length: 4 },
    });
    const write = requests.at(-1) as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.range).toMatchObject({ sheetId: 30, startRowIndex: 0 });
    expect(write.updateCells.rows[0]!.values.map((v) => v.userEnteredValue)).toEqual(
      PAYCHECK_HEADER.map((stringValue) => ({ stringValue }))
    );
    expect(layout.paychecksLegacy).toBeUndefined();
  });

  it('adds the _Paychecks tab, header first, the first time paychecks are saved', async () => {
    const base = await loaded();
    const { requests, layout } = saveRequests(base, { ...base.data, paychecks: PAY });
    expect(requests[0]).toMatchObject({ addSheet: { properties: { title: 'Paychecks' } } });
    expect(requests[0]).toMatchObject({
      addSheet: { properties: { gridProperties: { columnCount: 5 } } },
    });
    expect(layout.paychecksSheetId).toBeDefined();
    const write = requests.at(-1) as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.rows).toHaveLength(3);
  });

  it('moves an old _Categories tab to _Metadata on the next save, in one batch', async () => {
    const connection = googleConnection(fakeSheet({ legacy: true }), {
      id: 'sheet',
      title: 'Ledger',
    });
    const base = await connection.load();
    expect(saveRequests(base, base.data).requests).toEqual([]);

    const next: LedgerData = {
      ...base.data,
      accounts: base.data.accounts.map((a) => (a.id === 20 ? { ...a, inverted: true } : a)),
    };
    const { requests, layout } = saveRequests(base, next);
    expect(requests.map((r) => Object.keys(r)[0])).toEqual([
      'addSheet',
      'updateCells',
      'updateCells',
      'deleteSheet',
    ]);
    expect(requests[0]).toMatchObject({ addSheet: { properties: { title: 'Ledger_Metadata' } } });
    const write = requests[2] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.rows.map((r) => r.values.map((c) => c.userEnteredValue))).toEqual([
      [
        { stringValue: 'category' },
        { stringValue: 'Food' },
        { stringValue: 'color' },
        { stringValue: '#4f7cff' },
      ],
      [
        { stringValue: 'account' },
        { stringValue: 'Savings' },
        { stringValue: 'inverted' },
        { boolValue: true },
      ],
    ]);
    expect(requests[3]).toEqual({ deleteSheet: { sheetId: 99 } });
    expect(layout.categoriesSheetId).toBeUndefined();
    expect(layout.metadataSheetId).toBeDefined();
    expect(layout.sheetIds).not.toContain(99);
  });

  it('migrates on any save, even one that changes nothing in the categories', async () => {
    const base = await googleConnection(fakeSheet({ legacy: true }), {
      id: 'sheet',
      title: 'Ledger',
    }).load();
    const next: LedgerData = {
      ...base.data,
      rows: { ...base.data.rows, 20: [] },
    };
    const kinds = saveRequests(base, next).requests.map((r) => Object.keys(r)[0]);
    expect(kinds).toContain('deleteSheet');
  });

  it('rewrites _Metadata when an account is marked inverted or renamed', async () => {
    const base = await loaded();
    const toggled: LedgerData = {
      ...base.data,
      accounts: base.data.accounts.map((a) => (a.id === 10 ? { ...a, inverted: true } : a)),
    };
    const { requests } = saveRequests(base, toggled);
    expect(requests).toHaveLength(1);
    const write = requests[0] as Extract<SheetsRequest, { updateCells: unknown }>;
    expect(write.updateCells.range?.sheetId).toBe(99);
    // Savings was already inverted in the sheet, and Current now is too.
    expect(write.updateCells.rows.map((r) => r.values[1]?.userEnteredValue)).toEqual([
      { stringValue: 'Food' },
      { stringValue: 'Current' },
      { stringValue: 'Savings' },
    ]);
  });

  it('creates the metadata tab when the sheet has none', async () => {
    const client = new FakeClient([tab(10, 'Current', 0)], { 10: [HEADER] });
    const connection = googleConnection(client, { id: 'sheet', title: 'Ledger' });
    const base = await connection.load();
    const saved = await connection.saver.save(base, {
      ...base.data,
      categories: [{ name: 'Food', color: '#4f7cff' }],
    });
    expect(client.updates).toHaveLength(1);
    expect(client.updates[0]![0]).toMatchObject({
      addSheet: { properties: { title: 'Ledger_Metadata' } },
    });
    expect(saved.layout.metadataSheetId).toBeDefined();
    expect(saved.data.categories).toHaveLength(1);
  });
});
