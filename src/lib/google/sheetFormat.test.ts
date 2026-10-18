import { describe, expect, it } from 'vitest';
import {
  isoDateToSerial,
  parseDateCell,
  parseNumberCell,
  metadataEntries,
  parseMetadata,
  rowsToCategories,
  parseAccountTab,
  parseDashboardCell,
  dashboardRow,
  serialToIsoDate,
  totalFormula,
  transactionRow,
} from './sheetFormat';

describe('dates', () => {
  it('converts between ISO dates and sheet serials', () => {
    expect(isoDateToSerial('1899-12-31')).toBe(1);
    expect(isoDateToSerial('2026-04-01')).toBe(46113);
    expect(serialToIsoDate(46113)).toBe('2026-04-01');
    expect(serialToIsoDate(46113.75)).toBe('2026-04-01');
    expect(() => isoDateToSerial('01/04/2026')).toThrow();
  });

  it('parses date cells', () => {
    expect(parseDateCell(46113)).toBe('2026-04-01');
    expect(parseDateCell(' 2026-04-01 ')).toBe('2026-04-01');
    expect(parseDateCell('yesterday')).toBe('');
    expect(parseDateCell(undefined)).toBe('');
  });
});

describe('parseNumberCell', () => {
  it('reads numbers and hand-typed amounts', () => {
    expect(parseNumberCell(-12.5)).toBe(-12.5);
    expect(parseNumberCell('£1,234.50')).toBe(1234.5);
    expect(parseNumberCell('(12.00)')).toBe(-12);
    expect(parseNumberCell('-3')).toBe(-3);
    expect(parseNumberCell('#REF!')).toBeNull();
    expect(parseNumberCell('')).toBeNull();
    expect(parseNumberCell(true)).toBeNull();
  });
});

describe('parseAccountTab', () => {
  const header = ['Date', 'Category', 'Amount', 'Note', 'Total'];

  it('reads rows under an exact header, dropping blank rows and ignoring totals', () => {
    expect(
      parseAccountTab([
        header,
        [46113, 'Salary', 1000, 'Pay', 1000],
        [],
        ['', '', '', ''],
        [46114, ' Food ', -20.5, '', '#REF!'],
      ])
    ).toEqual({
      rows: [
        { date: '2026-04-01', category: 'Salary', amount: 1000, note: 'Pay' },
        { date: '2026-04-02', category: 'Food', amount: -20.5, note: '' },
      ],
    });
  });

  it('accepts an account with no rows yet', () => {
    expect(parseAccountTab([header])).toEqual({ rows: [] });
  });

  it('rejects tabs that are not in the Ledger format', () => {
    expect(parseAccountTab([])).toEqual({ error: expect.stringContaining('Row 1') });
    expect(parseAccountTab([['Date', 'Description', 'Amount']])).toHaveProperty('error');
    expect(parseAccountTab([[...header, 'Balance']])).toHaveProperty('error');
    expect(parseAccountTab([header.map((h) => h.toLowerCase())])).toHaveProperty('error');
    expect(parseAccountTab([header, ['Opening', '', 10]])).toEqual({
      error: 'Row 2 has no valid date',
    });
    expect(parseAccountTab([header, [46113, '', 'ten']])).toEqual({
      error: 'Row 2 has no valid amount',
    });
  });
});

describe('dashboard cell', () => {
  it('round-trips JSON and treats unreadable text as no config', () => {
    const row = dashboardRow({ widgets: [{ kind: 'netWorth' }] });
    const text = row.values[0]?.userEnteredValue?.stringValue;
    expect(parseDashboardCell(text)).toEqual({ widgets: [{ kind: 'netWorth' }] });
    expect(parseDashboardCell('{oops')).toBeNull();
    expect(parseDashboardCell(undefined)).toBeNull();
    expect(dashboardRow(null).values).toEqual([{}]);
  });
});

describe('transactionRow', () => {
  it('writes typed cells so text is never treated as a formula', () => {
    const row = transactionRow(
      { date: '2026-04-01', category: 'Bills', amount: -9.99, note: '=1+1' },
      12
    );
    expect(row.values.map((c) => c.userEnteredValue)).toEqual([
      { numberValue: 46113 },
      { stringValue: 'Bills' },
      { numberValue: -9.99 },
      { stringValue: '=1+1' },
      { formulaValue: '=SUM($C$2:C12)' },
    ]);
    expect(row.values[0]?.userEnteredFormat?.numberFormat?.type).toBe('DATE');
    expect(totalFormula(2)).toBe('=SUM($C$2:C2)');
  });
});

describe('rowsToCategories', () => {
  it('skips blank names and replaces invalid colours', () => {
    expect(rowsToCategories([['Rent', '#D9534F'], [''], ['Food', 'red'], ['  Fun  ']])).toEqual([
      { name: 'Rent', color: '#D9534F' },
      { name: 'Food', color: '' },
      { name: 'Fun', color: '' },
    ]);
  });
});

describe('_Metadata', () => {
  it('reads categories and inverted accounts, skipping rows it does not know', () => {
    expect(
      parseMetadata([
        ['category', 'Rent', 'color', '#D9534F'],
        ['category', 'Food', 'color', 'red'],
        ['category', '', 'color', '#000000'],
        ['account', 'Visa', 'inverted', true],
        ['account', 'Loan', 'inverted', 'yes'],
        ['account', 'Current', 'inverted', 'FALSE'],
        ['account', 'Savings', 'inverted'],
        ['account', 'Visa', 'something', 'else'],
        ['future', 'x', 'y', 'z'],
        [],
      ])
    ).toEqual({
      categories: [
        { name: 'Rent', color: '#D9534F' },
        { name: 'Food', color: '' },
      ],
      invertedAccounts: ['Visa', 'Loan'],
    });
  });

  it('reads and writes excluded categories, whichever order the rows come in', () => {
    const values = [
      ['category', 'transfers', 'excluded', true],
      ['category', 'Transfers', 'color', '#bb9dff'],
      ['category', 'Food', 'color', '#4f7cff'],
      ['category', 'Food', 'excluded', 'FALSE'],
      ['category', 'Gifts', 'excluded', 'yes'],
    ];
    const { categories } = parseMetadata(values);
    expect(categories).toEqual([
      { name: 'Transfers', color: '#bb9dff', excluded: true },
      { name: 'Food', color: '#4f7cff' },
      { name: 'Gifts', color: '', excluded: true },
    ]);
    expect(metadataEntries(categories, []).filter((e) => e.setting === 'excluded')).toEqual([
      { type: 'category', name: 'Transfers', setting: 'excluded', value: true },
      { type: 'category', name: 'Gifts', setting: 'excluded', value: true },
    ]);
  });

  it('reads and writes the accounts a category is limited to; none means global', () => {
    const values = [
      ['category', 'Interest', 'account', 'Savings'],
      ['category', 'Interest', 'color', '#f2b84b'],
      ['category', 'Interest', 'account', 'ISA'],
      ['category', 'Interest', 'account', 'Savings'],
      ['category', 'Food', 'color', '#4f7cff'],
      ['category', 'Food', 'account', ''],
      ['category', 'Fees', 'account', 'Current'],
    ];
    const { categories } = parseMetadata(values);
    expect(categories).toEqual([
      { name: 'Interest', color: '#f2b84b', accounts: ['Savings', 'ISA'] },
      { name: 'Food', color: '#4f7cff' },
      { name: 'Fees', color: '', accounts: ['Current'] },
    ]);
    expect(metadataEntries(categories, []).filter((e) => e.setting === 'account')).toEqual([
      { type: 'category', name: 'Interest', setting: 'account', value: 'Savings' },
      { type: 'category', name: 'Interest', setting: 'account', value: 'ISA' },
      { type: 'category', name: 'Fees', setting: 'account', value: 'Current' },
    ]);
  });

  it('writes only the settings that differ from the default, categories first', () => {
    expect(
      metadataEntries(
        [{ name: 'Food', color: '#4f7cff' }],
        [
          { id: 1, name: 'Current' },
          { id: 2, name: 'Visa', inverted: true },
        ]
      )
    ).toEqual([
      { type: 'category', name: 'Food', setting: 'color', value: '#4f7cff' },
      { type: 'account', name: 'Visa', setting: 'inverted', value: true },
    ]);
  });
});
