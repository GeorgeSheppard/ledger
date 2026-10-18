import { describe, expect, it } from 'vitest';
import { applyMapping, guessMapping, mappingProblems, toTable } from './mapping';
import { parseCsv } from '../../../lib/csv/parse';

describe('toTable', () => {
  it('uses the first row as the header', () => {
    const table = toTable(parseCsv('Date,Amount\n2026-01-01,5\n2026-01-02,6'));
    expect(table.hasHeader).toBe(true);
    expect(table.headers).toEqual(['Date', 'Amount']);
    expect(table.rows).toEqual([
      ['2026-01-01', '5'],
      ['2026-01-02', '6'],
    ]);
    expect(table.lines).toEqual([2, 3]);
  });

  it('skips preamble lines above the header', () => {
    const table = toTable(
      parseCsv('Account: 1234\nStatement for March\nDate,Description,Amount\n01/03/2026,Tea,-2')
    );
    expect(table.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(table.lines).toEqual([4]);
  });

  it('treats a first row of data as data', () => {
    const table = toTable(parseCsv('01/03/2026,Tea,-2\n02/03/2026,Cake,-3'));
    expect(table.hasHeader).toBe(false);
    expect(table.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(table.rows).toHaveLength(2);
    expect(table.lines).toEqual([1, 2]);
  });

  it('can be told whether there is a header, and pads short rows', () => {
    const table = toTable(
      [
        ['a', 'b', 'c'],
        ['1', '2'],
        ['1', '2', '3'],
      ],
      false
    );
    expect(table.rows[0]).toEqual(['a', 'b', 'c']);
    expect(table.rows[1]).toEqual(['1', '2', '']);
  });
});

describe('guessMapping', () => {
  it('maps a typical single-amount export', () => {
    const table = toTable(
      parseCsv(
        'Transaction Date,Description,Amount,Balance,Category\n05/03/2026,Tesco,-12.40,100.00,groceries'
      )
    );
    expect(guessMapping(table)).toEqual({
      date: 0,
      amount: 2,
      debit: null,
      credit: null,
      note: 1,
      category: 4,
      dateFormat: 'dmy',
      invertAmounts: false,
    });
  });

  it('maps money in and money out columns', () => {
    const table = toTable(
      parseCsv('Date,Details,Money Out,Money In,Balance\n2026-03-05,Rent,1100.00,,500.00')
    );
    expect(guessMapping(table)).toMatchObject({
      date: 0,
      amount: null,
      debit: 2,
      credit: 3,
      note: 1,
      dateFormat: 'ymd',
    });
  });

  it('does not mistake Value Date for the amount', () => {
    const table = toTable(parseCsv('Value Date,Narrative,Value\n2026-03-05,Tea,-2'));
    expect(guessMapping(table)).toMatchObject({ date: 0, note: 1, amount: 2 });
  });

  it('falls back to the column contents when there is no header', () => {
    const table = toTable(parseCsv('Tea,7 Mar 2026,-2.00\nCake,8 Mar 2026,-3.00'));
    expect(guessMapping(table)).toMatchObject({
      date: 1,
      amount: 2,
      note: 0,
      dateFormat: 'dmy-name',
    });
  });
});

describe('applyMapping', () => {
  const table = toTable(
    parseCsv(
      [
        'Date,Payee,Out,In',
        '05/03/2026,Shop,12.40,',
        '06/03/2026,Employer,,2000',
        'not a date,Shop,1,',
        '07/03/2026,Shop,abc,',
        '08/03/2026,Nothing,,',
      ].join('\n')
    )
  );
  const mapping = guessMapping(table);

  it('combines money in and out and reports bad rows', () => {
    const rows = applyMapping(table, mapping);
    expect(rows.map((r) => r.input ?? r.error)).toEqual([
      { date: '2026-03-05', amount: -12.4, note: 'Shop', category: '' },
      { date: '2026-03-06', amount: 2000, note: 'Employer', category: '' },
      '"not a date" is not a date',
      '"abc" is not an amount',
      'No amount',
    ]);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
  });

  it('can invert amounts', () => {
    const [first] = applyMapping(table, { ...mapping, invertAmounts: true });
    expect(first?.input?.amount).toBe(12.4);
  });

  it('reports missing required columns', () => {
    expect(mappingProblems({ ...mapping, date: null, debit: null, credit: null })).toHaveLength(2);
    expect(mappingProblems(mapping)).toEqual([]);
  });
});
