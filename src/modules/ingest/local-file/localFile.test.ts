import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { DASHBOARD_TAB } from '../../../lib/domain/types';
import { fixtureData } from '../../../lib/data/fixtures';
import { parsePaychecks } from '../../../lib/paychecks/serialize';
import type { RemoteState } from '../../../lib/store/remote';
import { LedgerStore } from '../../../lib/store/ledgerStore';
import { fileSaver } from '../../save';
import { writeWorkbook } from '../../save/local-file/workbook';
import { remoteOf } from '../types';
import { localFileIngest, newLocalLedger } from '.';
import { ledgerFromTabs, readWorkbookTabs } from './workbook';

/** A file ledger held in memory, saved by downloading. */
function fileRemote(title: string, state: RemoteState, original: ArrayBuffer | null) {
  return remoteOf({
    title,
    load: async () => structuredClone(state),
    saver: fileSaver(
      title,
      state.data.accounts.map((a) => a.id),
      original
    ),
  });
}

const blankLedger = (title: string) => ({ remote: remoteOf(newLocalLedger(title)) });

async function openLedgerFile(file: File) {
  const connection = await localFileIngest.open(file);
  return { title: connection.title, remote: remoteOf(connection) };
}

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
  const paycheck = book.addWorksheet('_Notes');
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
    expect(state.data.paychecks).toEqual(data.paychecks);
  });

  it('round-trips the paychecks, and reads an older file by converting its paychecks', async () => {
    const data = fixtureData();
    const kept = ledgerFromTabs(await readWorkbookTabs(await writeWorkbook(null, [], data)));
    expect(kept.data.paychecks).toEqual(data.paychecks);
    expect(parsePaychecks(kept.data.paychecks).paychecks).toHaveLength(6);

    // A file from before the table: JSON in A2 under a one-column header. It is read, and the next
    // write replaces it with the table.
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(asBuffer(await writeWorkbook(null, [], data)));
    book.removeWorksheet(book.getWorksheet('_Paychecks')!.id);
    const old = book.addWorksheet('_Paychecks');
    old.addRows([
      ['Paychecks'],
      [
        JSON.stringify({
          version: 1,
          paychecks: [
            {
              id: 'p1',
              name: 'Acme',
              date: '2026-03-25',
              gross: 3000,
              deductions: [{ id: 'd1', name: 'Tax', amount: 500 }],
              accountId: 1,
              repeat: 'monthly',
              until: '2026-04-30',
            },
          ],
        }),
      ],
    ]);
    const legacy = new Uint8Array(await book.xlsx.writeBuffer());
    const read = ledgerFromTabs(await readWorkbookTabs(legacy));
    expect(parsePaychecks(read.data.paychecks).paychecks.map((p) => p.date)).toEqual([
      '2026-03-25',
      '2026-04-25',
    ]);

    const rewritten = new ExcelJS.Workbook();
    await rewritten.xlsx.load(asBuffer(await writeWorkbook(legacy, [], read.data)));
    const sheet = rewritten.getWorksheet('_Paychecks')!;
    expect([1, 2, 3, 4, 5].map((c) => sheet.getCell(1, c).value)).toEqual([
      'Date',
      'Paycheck',
      'Type',
      'Name',
      'Amount',
    ]);
    expect(sheet.getCell('C2').value).toBe('Income');
    expect(sheet.getCell('E3').value).toBe(500);
    expect(sheet.getCell('A2').numFmt).toBe('yyyy-mm-dd');
  });

  it('round-trips inverted accounts through _Metadata and drops an old _Categories tab', async () => {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await userWorkbook());
    book.addWorksheet('_Categories').addRows([
      ['Name', 'Color'],
      ['Rent', '#d9534f'],
    ]);
    const original = asBuffer(new Uint8Array(await book.xlsx.writeBuffer()));

    const state = ledgerFromTabs(await readWorkbookTabs(original));
    const remote = fileRemote('mine', state, original);
    const store = await LedgerStore.open({ spreadsheetId: 'file', remote });
    const [bank] = await store.listAccounts();
    await store.setAccountInverted(bank!.id, true);
    const file = await store.download();

    const written = new ExcelJS.Workbook();
    await written.xlsx.load(asBuffer(file.bytes));
    expect(written.getWorksheet('_Categories')).toBeUndefined();
    expect(written.getWorksheet('_Metadata')!.getRow(1).values).toEqual([
      undefined,
      'Type',
      'Name',
      'Setting',
      'Value',
    ]);

    const reread = ledgerFromTabs(await readWorkbookTabs(file.bytes));
    expect(reread.data.accounts.find((a) => a.name === bank!.name)?.inverted).toBe(true);
    expect(reread.data.categories).toEqual(await store.listCategories());
    expect(reread.data.categories[0]).toEqual({ name: 'Rent', color: '#d9534f' });
  });

  it('round-trips an excluded category through _Metadata', async () => {
    const state = ledgerFromTabs(await readWorkbookTabs(await userWorkbook()));
    const remote = fileRemote('mine', state, await userWorkbook());
    const store = await LedgerStore.open({ spreadsheetId: 'file', remote });
    const [first] = await store.listCategories();
    await store.saveCategories([{ ...first!, excluded: true }]);
    const file = await store.download();
    const reread = ledgerFromTabs(await readWorkbookTabs(file.bytes));
    expect(reread.data.categories.find((c) => c.name === first!.name)?.excluded).toBe(true);
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
      '_Metadata',
      '_Paychecks',
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
      '_Notes',
      '_Metadata',
    ]);
    expect(book.getWorksheet('_Notes')!.getCell('B2').value).toMatchObject({
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
