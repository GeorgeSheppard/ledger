import { describe, expect, it } from 'vitest';
import { applyMapping } from '../shared/mapping';
import { parsePastedText } from './pasted';

/**
 * The pastes below imitate what copying from a bank's website looks like: layouts typical of UK,
 * US and European banks plus page furniture around them. They are written by hand, not real
 * exports, so each bank is a style rather than a guarantee about that bank.
 */

const today = '2026-10-18';

/** Date, note and amount of each parsed row. */
function rowsOf(text: string, options: { dayFirst?: boolean } = {}) {
  const parsed = parsePastedText(text, { today, ...options });
  return parsed.table.rows.map(([date, note, amount]) => [date, note, Number(amount)]);
}

describe('single-line statements', () => {
  it('reads a UK web statement with money out/in columns and a balance, newest first', () => {
    const text = `
Skip to main content
Your accounts  >  Current account  >  Transactions
Showing 1-4 of 134
Date	Description	Money out	Money in	Balance
Download statement
15 Oct 2026 TESCO STORES 3412 £23.45 £1,204.10
14 Oct 2026 ACME LTD SALARY £2,400.00 £1,227.55
13 Oct 2026 NETFLIX.COM £10.99 -£1,172.45
12 Oct 2026 CARD PAYMENT TO PRET A MANGER £4.20 -£1,161.46
Page 1 of 34
© 2026 Example Bank plc`;
    // The balance goes overdrawn on the third line, which does not confuse the balance check.
    expect(rowsOf(text)).toEqual([
      ['2026-10-15', 'TESCO STORES 3412', -23.45],
      ['2026-10-14', 'ACME LTD SALARY', 2400],
      ['2026-10-13', 'NETFLIX.COM', -10.99],
      ['2026-10-12', 'CARD PAYMENT TO PRET A MANGER', -4.2],
    ]);
  });

  it('works out the sign of unsigned amounts from the running balance, oldest first', () => {
    const text = `
01/10/2026 OPENING PAYMENT 100.00 1,100.00
02/10/2026 GREGGS 3.50 1,096.50
03/10/2026 REFUND ASOS 20.00 1,116.50
04/10/2026 RENT 800.00 316.50`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-01', 'OPENING PAYMENT', -100], // first row has nothing before it to compare with
      ['2026-10-02', 'GREGGS', -3.5],
      ['2026-10-03', 'REFUND ASOS', 20],
      ['2026-10-04', 'RENT', -800],
    ]);
  });

  it('works out the sign from the balance when newest first', () => {
    const text = `
04/10/2026 RENT 800.00 316.50
03/10/2026 FRIEND PAID YOU BACK 20.00 1,116.50
02/10/2026 GREGGS 3.50 1,096.50`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-04', 'RENT', -800],
      ['2026-10-03', 'FRIEND PAID YOU BACK', 20],
      ['2026-10-02', 'GREGGS', -3.5], // oldest row: nothing to compare, so assumed money out
    ]);
  });

  it('reads a US checking export with month-first dates and signed amounts', () => {
    const text = `
Account Activity
Posted	Date  Description  Amount  Running Bal.
10/13/2026 STARBUCKS STORE 12345 SEATTLE WA -5.75 2,204.10
10/12/2026 DIRECT DEPOSIT ACME INC +3,150.00 2,209.85
10/05/2026 AMAZON.COM*2K4LP0 -42.99 -940.15
Download CSV`;
    const parsed = parsePastedText(text, { today });
    expect(parsed.warnings).toEqual([]);
    expect(rowsOf(text)).toEqual([
      ['2026-10-13', 'STARBUCKS STORE 12345 SEATTLE WA', -5.75],
      ['2026-10-12', 'DIRECT DEPOSIT ACME INC', 3150],
      ['2026-10-05', 'AMAZON.COM*2K4LP0', -42.99],
    ]);
  });

  it('reads a credit card statement with CR/DR suffixes and brackets', () => {
    const text = `
12/10/2026 AMAZON.CO.UK 45.99 DR
13/10/2026 PAYMENT RECEIVED - THANK YOU 200.00 CR
14/10/2026 UBER *TRIP HELP.UBER.COM (12.30)`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-12', 'AMAZON.CO.UK', -45.99],
      ['2026-10-13', 'PAYMENT RECEIVED - THANK YOU', 200],
      ['2026-10-14', 'UBER *TRIP HELP.UBER.COM', -12.3],
    ]);
  });

  it('reads a European export with decimal commas, dotted dates and currency codes', () => {
    const text = `
12.10.2026 REWE SAGT DANKE -23,45 EUR 1.204,10 EUR
13.10.2026 GEHALT ACME GMBH 2.400,00 EUR 3.604,10 EUR
14.10.2026 MIETE OKTOBER -950,00 EUR 2.654,10 EUR`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-12', 'REWE SAGT DANKE', -23.45],
      ['2026-10-13', 'GEHALT ACME GMBH', 2400],
      ['2026-10-14', 'MIETE OKTOBER', -950],
    ]);
  });

  it('uses a labelled balance rather than guessing which number it is', () => {
    const text = '12 Oct 2026 COOP -£8.20 Balance: £91.80\n13 Oct 2026 TFL £2.80 Balance £89.00';
    expect(rowsOf(text)).toEqual([
      ['2026-10-12', 'COOP', -8.2],
      ['2026-10-13', 'TFL', -2.8],
    ]);
  });
});

describe('dates', () => {
  it('reads day-first and month-first numeric dates from the evidence in the text', () => {
    expect(rowsOf('13/10/2026 A -1.00\n02/10/2026 B -2.00').map((r) => r[0])).toEqual([
      '2026-10-13',
      '2026-10-02',
    ]);
    expect(rowsOf('10/13/2026 A -1.00\n02/10/2026 B -2.00').map((r) => r[0])).toEqual([
      '2026-10-13',
      '2026-02-10',
    ]);
  });

  it('warns when numeric dates are ambiguous, and honours an explicit choice', () => {
    const text = '03/04/2026 A -1.00';
    const parsed = parsePastedText(text, { today });
    expect(parsed.table.rows[0]?.[0]).toBe('2026-04-03');
    expect(parsed.warnings.join(' ')).toMatch(/two ways/);
    expect(rowsOf(text, { dayFirst: false })[0]?.[0]).toBe('2026-03-04');
    expect(parsePastedText(text, { today, dayFirst: false }).warnings).toEqual([]);
  });

  it('reads weekday names, ordinals, month-first names and ISO dates', () => {
    const text = `
Sat 10 Oct 2026 PUB -£12.00
October 9th, 2026 CAFE -£3.00
2026-10-08 BUS -£2.00
7th October 2026 TRAIN -£20.00`;
    expect(rowsOf(text).map((r) => r[0])).toEqual([
      '2026-10-10',
      '2026-10-09',
      '2026-10-08',
      '2026-10-07',
    ]);
  });

  it('puts dates without a year in the most recent year that is not in the future', () => {
    const text = '12 Oct COFFEE -£3.00\n2 Dec TRAIN -£20.00';
    expect(rowsOf(text).map((r) => r[0])).toEqual(['2026-10-12', '2025-12-02']);
  });

  it('does not take a street number before a month-like word for a date', () => {
    expect(rowsOf('12/10/2026 5 MARKET ST BAKERY -£3.00')).toEqual([
      ['2026-10-12', '5 MARKET ST BAKERY', -3],
    ]);
  });

  it('ignores times and a second (value) date on the same line', () => {
    expect(rowsOf('12 Oct 2026 14 Oct 2026 14:32 SHELL 1234 -£40.00')).toEqual([
      ['2026-10-12', 'SHELL 1234', -40],
    ]);
  });
});

describe('transactions spread over several lines', () => {
  it('reads an app-style list under date headings with Today and Yesterday', () => {
    const text = `
Transactions
Search
Today
Pret A Manger
-£3.50
Yesterday
Acme Ltd
+£2,400.00
Tesco
-£23.45
Saturday 10 October
Spotify
-£10.99
Load more`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-18', 'Pret A Manger', -3.5],
      ['2026-10-17', 'Acme Ltd', 2400],
      ['2026-10-17', 'Tesco', -23.45],
      ['2026-10-10', 'Spotify', -10.99],
    ]);
  });

  it('joins a category line with the merchant and handles a date line above each item', () => {
    const text = `
12 October 2026
Co-op
Groceries
-£8.20
13 October 2026
Monthly pass
TfL
£156.00`;
    expect(rowsOf(text)).toEqual([
      ['2026-10-12', 'Co-op Groceries', -8.2],
      ['2026-10-13', 'Monthly pass TfL', -156],
    ]);
  });

  it('ignores page furniture between a merchant and its amount', () => {
    const text = 'Today\nCosta\nShow more\n-£4.10';
    expect(rowsOf(text)).toEqual([['2026-10-18', 'Costa', -4.1]]);
  });
});

describe('junk and edge cases', () => {
  it('skips balance and total lines, headers and navigation', () => {
    const text = `
Home
Statement
Date Description Amount Balance
01 Oct 2026 Balance brought forward £1,227.55
02 Oct 2026 TOTAL WINE £30.00 £1,197.55
Total money out £30.00
Closing balance £1,197.55
Privacy  Terms  Contact us`;
    const rows = rowsOf(text);
    expect(rows).toEqual([['2026-10-02', 'TOTAL WINE', -30]]);
  });

  it('warns about lines with an amount and no date, and drops them', () => {
    const parsed = parsePastedText('Coffee -£3.00\n12 Oct 2026 Tea -£2.00', { today });
    expect(parsed.table.rows).toEqual([['2026-10-12', 'Tea', '-2.00']]);
    expect(parsed.warnings.join(' ')).toMatch(/1 line with an amount but no date was skipped/);
  });

  it('warns once when it had to assume amounts are money out', () => {
    const parsed = parsePastedText('12 Oct 2026 COFFEE 3.00\n13 Oct 2026 TEA 2.00', { today });
    expect(parsed.table.rows.map((r) => r[2])).toEqual(['-3.00', '-2.00']);
    expect(parsed.warnings).toEqual([
      '2 amounts have no sign, so they are treated as money out. Use the invert option if that is the wrong way round.',
    ]);
  });

  it('treats unsigned income words as money in', () => {
    expect(rowsOf('12 Oct 2026 SALARY ACME 2,400.00')[0]?.[2]).toBe(2400);
  });

  it('copes with non-breaking spaces, unicode minus and zero-width characters', () => {
    const text = '12 Oct 2026​ TESCO −£23.45';
    expect(rowsOf(text)).toEqual([['2026-10-12', 'TESCO', -23.45]]);
  });

  it('copes with Windows line endings and blank lines', () => {
    expect(rowsOf('\r\n12 Oct 2026 A -1.00\r\n\r\n13 Oct 2026 B -2.00\r\n')).toHaveLength(2);
  });

  it('reports a paste with no transactions', () => {
    const parsed = parsePastedText('Hello there\nNothing to see', { today });
    expect(parsed.table.rows).toEqual([]);
    expect(parsed.warnings).toEqual([
      'No transactions found. Each one needs a date and an amount.',
    ]);
  });

  it('records the pasted line of each row for error messages', () => {
    const parsed = parsePastedText('Menu\n12 Oct 2026 A -1.00\n\n13 Oct 2026 B -2.00', { today });
    expect(parsed.table.lines).toEqual([2, 4]);
  });
});

describe('copied tables', () => {
  it('hands tab-separated cells to the CSV mapping, dropping junk lines', () => {
    const text = [
      'Your transactions',
      'Date\tDescription\tMoney out\tMoney in\tBalance',
      '12/10/2026\tTESCO STORES\t23.45\t\t1,204.10',
      '13/10/2026\tACME SALARY\t\t2,400.00\t3,604.10',
      'Page 1 of 1',
    ].join('\n');
    const parsed = parsePastedText(text, { today });
    expect(parsed.kind).toBe('table');
    const mapped = applyMapping(parsed.table, parsed.mapping).map((r) => r.input);
    expect(mapped).toEqual([
      { date: '2026-10-12', amount: -23.45, note: 'TESCO STORES', category: '' },
      { date: '2026-10-13', amount: 2400, note: 'ACME SALARY', category: '' },
    ]);
  });
});

describe('feeding the import pipeline', () => {
  it('produces a table and mapping that applyMapping accepts unchanged', () => {
    const parsed = parsePastedText('12 Oct 2026 TESCO -£23.45\n13 Oct 2026 TFL -£2.80', { today });
    expect(parsed.kind).toBe('text');
    const rows = applyMapping(parsed.table, parsed.mapping);
    expect(rows.map((r) => r.error)).toEqual([undefined, undefined]);
    expect(rows.map((r) => r.input)).toEqual([
      { date: '2026-10-12', amount: -23.45, note: 'TESCO', category: '' },
      { date: '2026-10-13', amount: -2.8, note: 'TFL', category: '' },
    ]);
  });
});
