import { describe, expect, it } from 'vitest';
import { parsePaychecks, serializePaychecks } from '../paychecks/serialize';
import type { JsonValue } from '../store/ledgerData';
import {
  isoDateToSerial,
  parseDateCell,
  parseNumberCell,
  metadataEntries,
  parseMetadata,
  rowsToCategories,
  parseAccountTab,
  serialToIsoDate,
  paycheckRows,
  paycheckValues,
  parsePaychecksTab,
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

  it('reads and writes archived categories as plain rows', () => {
    const { categories } = parseMetadata([
      ['category', 'Gym', 'color', '#4f7cff'],
      ['category', 'Gym', 'archived', 'TRUE'],
      ['category', 'Food', 'color', '#d9534f'],
      ['category', 'Food', 'archived', 'no'],
    ]);
    expect(categories).toEqual([
      { name: 'Gym', color: '#4f7cff', archived: true },
      { name: 'Food', color: '#d9534f' },
    ]);
    expect(metadataEntries(categories, []).filter((e) => e.setting === 'archived')).toEqual([
      { type: 'category', name: 'Gym', setting: 'archived', value: true },
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

describe('_Paychecks', () => {
  const header = ['Date', 'Tax code', 'Type', 'Name', 'Amount'];
  const oldHeader = ['Date', 'Paycheck', 'Type', 'Name', 'Amount'];

  it('reads one payslip per date and label in the old layout, skipping rows it cannot read', () => {
    const stored = parsePaychecksTab([
      oldHeader,
      ['2026-01-25', 'a', 'Income', 'Salary', 3000],
      [46047, 'a', 'income', 'Allowance', '£200.50'],
      ['2026-01-25', 'a', 'Deduction', 'Tax', 600],
      ['2026-01-25', 'b', 'Income', 'Cafe', 100],
      ['2026-01-25', 'b', 'Tip', 'Cafe', 100],
      ['nope', 'b', 'Income', 'Cafe', 100],
      ['2026-01-25', 'b', 'Income', 'Cafe', -5],
    ]);
    const list = parsePaychecks(stored).paychecks;
    expect(list).toHaveLength(2);
    expect(list[0]!.income.map((l) => [l.name, l.amount])).toEqual([
      ['Salary', 3000],
      ['Allowance', 200.5],
    ]);
    expect(list[1]!.income.map((l) => l.name)).toEqual(['Cafe']);
  });

  it('reads one payslip per date, with its tax code', () => {
    const { paychecks } = parsePaychecks(
      parsePaychecksTab([
        header,
        ['2026-01-25', '1257L', 'Income', 'Salary', 3000],
        ['2026-01-25', '1257L', 'Deduction', 'Tax', 600],
        ['2026-02-25', '', 'Income', 'Salary', 3000],
      ])
    );
    expect(paychecks).toHaveLength(2);
    expect(paychecks[0]).toMatchObject({ taxCode: '1257L' });
    expect(paychecks[0]!.deductions).toHaveLength(1);
    expect(paychecks[1]!.taxCode).toBeUndefined();
  });

  it('is empty for a table with no usable rows', () => {
    expect(parsePaychecksTab([header])).toBeNull();
    expect(parsePaychecksTab([])).toBeNull();
  });

  it('reads a Benefit in kind row into the payslip', () => {
    const { paychecks } = parsePaychecks(
      parsePaychecksTab([
        header,
        ['2026-01-25', '', 'Income', 'Salary', 3000],
        ['2026-01-25', '', 'Benefit in kind', 'Company car', 150],
      ])
    );
    expect(paychecks[0]!.benefits).toMatchObject([{ name: 'Company car', amount: 150 }]);
  });

  it('writes one row per line with the tax code on each, and reads it back', () => {
    const stored = serializePaychecks({
      paychecks: [
        {
          id: 'x',
          date: '2026-01-25',
          taxCode: '1257L',
          income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
          benefits: [{ id: 'l1', name: 'Health insurance', amount: 80 }],
          deductions: [{ id: 'l1', name: 'Tax', amount: 600 }],
        },
        {
          id: 'y',
          date: '2026-02-25',
          income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
          benefits: [],
          deductions: [],
        },
      ],
    }) as unknown as JsonValue;
    expect(paycheckValues(stored)).toEqual([
      ['2026-01-25', '1257L', 'Income', 'Salary', 3000],
      ['2026-01-25', '1257L', 'Benefit in kind', 'Health insurance', 80],
      ['2026-01-25', '1257L', 'Deduction', 'Tax', 600],
      ['2026-02-25', '', 'Income', 'Salary', 3000],
    ]);
    expect(paycheckRows(stored)).toHaveLength(5);
    const read = parsePaychecks(parsePaychecksTab([header, ...paycheckValues(stored)])).paychecks;
    expect(read.map((p) => p.taxCode)).toEqual(['1257L', undefined]);
  });
});
