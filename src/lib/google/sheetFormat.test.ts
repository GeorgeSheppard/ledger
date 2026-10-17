import { describe, expect, it } from 'vitest';
import {
  isoDateToSerial,
  parseDateCell,
  parseNumberCell,
  rowsToCategories,
  rowsToTransactions,
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

describe('rowsToTransactions', () => {
  it('maps rows, keeps sheet row numbers across blank rows, and prefers the sheet total', () => {
    const rows = rowsToTransactions(7, [
      [46113, 'Salary', 1000, 'Pay', 1000],
      [],
      ['', '', '', ''],
      [46114, 'Food', -20.5, '', 979.5],
    ]);
    expect(rows).toEqual([
      {
        id: '7:2',
        accountId: 7,
        row: 2,
        date: '2026-04-01',
        category: 'Salary',
        amount: 1000,
        note: 'Pay',
        total: 1000,
      },
      {
        id: '7:5',
        accountId: 7,
        row: 5,
        date: '2026-04-02',
        category: 'Food',
        amount: -20.5,
        note: '',
        total: 979.5,
      },
    ]);
  });

  it('computes the running total when the Total cell is broken', () => {
    const rows = rowsToTransactions(1, [
      [46113, '', 10, '', '#REF!'],
      [46113, '', 5],
    ]);
    expect(rows.map((r) => r.total)).toEqual([10, 15]);
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
      { name: 'Food', color: '#8b8d98' },
      { name: 'Fun', color: '#8b8d98' },
    ]);
  });
});
