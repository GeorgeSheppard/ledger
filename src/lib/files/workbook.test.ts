import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { fixtureData } from '../data/fixtures';
import { DASHBOARD_TAB } from '../google/sheetsRemote';
import { LedgerStore } from '../store/ledgerStore';
import { blankLedger, fileRemote, openLedgerFile } from './fileRemote';
import { ledgerFromTabs, readWorkbookTabs, writeWorkbook } from './workbook';

const asBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** A workbook as a user might have made it: ledger tabs, plus tabs Ledger knows nothing about. */
async function userWorkbook(): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  const bank = book.addWorksheet('Bank');
  bank.addRows([
    ['Date', 'Category', 'Amount', 'Note', 'Total'],
    [
      new Date(Date.UTC(2026, 0, 5)),
      'Rent',
      -900,
      'January',
      { formula: 'SUM($C$2:C2)', result: -900 },
    ],
    ['2026-01-09', 'Salary', 2000, 'Payroll', { formula: 'SUM($C$2:C3)', result: 1100 }],
  ]);
  const notes = book.addWorksheet('Budget 2026');
  notes.addRows([
    ['Item', 'Planned'],
    ['Food', 300],
  ]);
  const paycheck = book.addWorksheet('_Paychecks');
  paycheck.addRows([
    ['Gross', 'Tax'],
    [3000, { formula: 'A2*0.2', result: 600 }],
  ]);
  return asBuffer(new Uint8Array(await book.xlsx.writeBuffer()));
}

describe('reading a workbook', () => {
  it('turns a Ledger-format tab into an account and skips the others', async () => {
    const state = ledgerFromTabs(await readWorkbookTabs(await userWorkbook()));
    expect(state.data.accounts.map((a) => a.name)).toEqual(['Bank']);
    expect(Object.values(state.data.rows)[0]).toEqual([
      { date: '2026-01-05', category: 'Rent', amount: -900, note: 'January' },
      { date: '2026-01-09', category: 'Salary', amount: 2000, note: 'Payroll' },
    ]);
    expect(state.skippedTabs.map((t) => t.title)).toEqual(['Budget 2026']);
  });

  it('explains a file with no Ledger tab instead of opening it empty', () => {
    expect(() =>
      ledgerFromTabs([{ id: 1, title: 'Budget', values: [['Item', 'Planned']] }])
    ).toThrow(/Date \| Category \| Amount \| Note \| Total/);
    expect(() => ledgerFromTabs([])).toThrow(/no tabs/);
  });

  it('rejects bytes that are not a workbook', async () => {
    await expect(readWorkbookTabs(new TextEncoder().encode('hello'))).rejects.toThrow(/xlsx/);
  });
});

describe('writing a workbook', () => {
  it('round-trips the ledger tabs in the Sheets format', async () => {
    const data = fixtureData();
    data.dashboard = { version: 1, widgets: [] };
    const bytes = await writeWorkbook(null, [], data);
    const state = ledgerFromTabs(await readWorkbookTabs(bytes));
    expect(state.data.accounts.map((a) => a.name)).toEqual(['Current account', 'Savings']);
    expect(Object.values(state.data.rows)).toEqual(data.accounts.map((a) => data.rows[a.id]));
    expect(state.data.categories).toEqual(data.categories);
    expect(state.data.dashboard).toEqual(data.dashboard);
  });

  it('writes dates as date cells and Total as a running SUM formula', async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(asBuffer(await writeWorkbook(null, [], fixtureData())));
    const sheet = book.getWorksheet('Savings')!;
    expect(sheet.getCell('A2').value).toEqual(new Date(Date.UTC(2026, 3, 1)));
    expect(sheet.getCell('A2').numFmt).toBe('yyyy-mm-dd');
    expect(sheet.getCell('E3').value).toMatchObject({ formula: 'SUM($C$2:C3)', result: 8500 });
    expect(book.worksheets.map((w) => w.name)).toEqual([
      'Current account',
      'Savings',
      '_Categories',
    ]);
  });

  it('leaves tabs it does not own exactly as they were', async () => {
    const original = await userWorkbook();
    const remote = fileRemote('mine', ledgerFromTabs(await readWorkbookTabs(original)), original);
    const store = await LedgerStore.open({ spreadsheetId: 'file', remote });
    const [bank] = await store.listAccounts();
    await store.addTransactions(bank!.id, [
      { date: '2026-01-07', category: 'Food', amount: -20, note: 'Lunch' },
    ]);
    await store.renameAccount(bank!.id, 'Current');
    const file = await store.download();

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(asBuffer(file.bytes));
    expect(book.worksheets.map((w) => w.name)).toEqual([
      'Current',
      'Budget 2026',
      '_Paychecks',
      '_Categories',
    ]);
    expect(book.getWorksheet('_Paychecks')!.getCell('B2').value).toMatchObject({
      formula: 'A2*0.2',
    });
    expect(book.getWorksheet('Budget 2026')!.getCell('B2').value).toBe(300);
    // The new transaction landed in date order, and Total follows.
    const current = book.getWorksheet('Current')!;
    expect(current.getCell('D3').value).toBe('Lunch');
    expect(current.getCell('E4').value).toMatchObject({ formula: 'SUM($C$2:C4)', result: 1080 });
    expect(book.getWorksheet(DASHBOARD_TAB)).toBeUndefined();
  });

  it('adds and removes accounts, clearing rows left over after deletes', async () => {
    const original = await writeWorkbook(null, [], fixtureData());
    const state = ledgerFromTabs(await readWorkbookTabs(original));
    const store = await LedgerStore.open({
      spreadsheetId: 'file',
      remote: fileRemote('mine', state, asBuffer(original)),
    });
    const [current, savings] = await store.listAccounts();
    await store.deleteTransaction(current!.id, 2);
    await store.deleteTransaction(current!.id, 2);
    await store.createAccount('Holiday');
    const reopened = ledgerFromTabs(await readWorkbookTabs((await store.download()).bytes));
    expect(reopened.data.accounts.map((a) => a.name)).toEqual([
      'Current account',
      'Savings',
      'Holiday',
    ]);
    expect(reopened.data.rows[current!.id]).toHaveLength((fixtureData().rows[1] ?? []).length - 2);
    expect(reopened.data.rows[savings!.id]).toHaveLength((fixtureData().rows[2] ?? []).length);

    await store.save();
    const smaller = new ExcelJS.Workbook();
    await smaller.xlsx.load(asBuffer((await store.download()).bytes));
    expect(smaller.worksheets.map((w) => w.name)).toContain('Holiday');
  });
});

describe('the store with a file', () => {
  it('counts changes as saved only once they are downloaded', async () => {
    const { remote } = blankLedger('Fresh');
    const store = await LedgerStore.open({ spreadsheetId: 'file', remote });
    expect(store.isFile).toBe(true);
    const [account] = await store.listAccounts();
    await store.addTransactions(account!.id, [
      { date: '2026-02-01', category: 'Income', amount: 5, note: '' },
    ]);
    expect(store.getStatus().state).toBe('unsaved');
    const file = await store.download();
    expect(file.name).toBe('Fresh.xlsx');
    expect(store.getStatus().state).toBe('saved');
  });
});

describe('opening a file', () => {
  it('reads a csv in the account format as one account named after the file', async () => {
    const csv = new File(
      ['Date,Category,Amount,Note,Total\n2026-03-01,Food,-4.5,Coffee,-4.5\n'],
      'Cash.csv',
      {
        type: 'text/csv',
      }
    );
    const { title, remote } = await openLedgerFile(csv);
    const { data } = await remote.load();
    expect(title).toBe('Cash');
    expect(data.accounts.map((a) => a.name)).toEqual(['Cash']);
    expect(data.rows[1]).toEqual([
      { date: '2026-03-01', category: 'Food', amount: -4.5, note: 'Coffee' },
    ]);
  });

  it('refuses a csv in some other format and other file types', async () => {
    await expect(
      openLedgerFile(new File(['Posted,Description,Debit\n1/2/26,Shop,4\n'], 'bank.csv'))
    ).rejects.toThrow(/Date \| Category/);
    await expect(openLedgerFile(new File(['x'], 'photo.png'))).rejects.toThrow(/\.xlsx and \.csv/);
  });
});
