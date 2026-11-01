import { describe, expect, it } from 'vitest';
import { looksLikeSplitwise, parseSplitwise } from './splitwise';

const SAMPLE = `November 2026View printable summary
Nov
01

Food
you paid
£84.00you lent Priya
£28.00
October 2026View printable summary
Oct
25

Weekend cabin trip 
Priya N. paid
£41.20Priya lent you
£41.20
Oct
22

Food
you paid
£63.00you lent Priya
£21.00
Oct
19

Online order
you paid
£35.50you lent Priya
£35.50
`;

describe('parseSplitwise', () => {
  it('reads what is owed to (+) or by (-) the user for each expense', () => {
    const { expenses, warnings } = parseSplitwise(SAMPLE);
    expect(expenses).toEqual([
      { date: '2026-11-01', description: 'Food', amount: 28 },
      { date: '2026-10-25', description: 'Weekend cabin trip', amount: -41.2 },
      { date: '2026-10-22', description: 'Food', amount: 21 },
      { date: '2026-10-19', description: 'Online order', amount: 35.5 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('is detected from the paste', () => {
    expect(looksLikeSplitwise(SAMPLE)).toBe(true);
    expect(looksLikeSplitwise('01/10/2026 TESCO 3.50')).toBe(false);
  });

  it('handles several people, other currencies and thousands separators', () => {
    const { expenses } = parseSplitwise(`March 2026View printable summary
Mar
03

Flights
Bob paid
€1,200.50Bob lent you, Cara
€400.25
Mar
02

Rent
you paid
$2,000.00you lent 2 people
$1,333.34`);
    expect(expenses).toEqual([
      { date: '2026-03-03', description: 'Flights', amount: -400.25 },
      { date: '2026-03-02', description: 'Rent', amount: 1333.34 },
    ]);
  });

  it('leaves out settle-ups and expenses the user was not part of, and says so', () => {
    const { expenses, warnings } = parseSplitwise(`May 2026View printable summary
May
04

Payment
Priya N. paid
£20.00you received
£20.00
May
03

Their dinner
Bob paid
£40.00Bob lent Cara
£20.00
May
02

Coffee
you paid
£4.00you lent Bob
£2.00`);
    expect(expenses).toEqual([{ date: '2026-05-02', description: 'Coffee', amount: 2 }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('2 Splitwise entries');
  });

  it('puts days from the previous year in the right year', () => {
    const { expenses } = parseSplitwise(`January 2026View printable summary
Jan
02

A
you paid
£10.00you lent Bob
£5.00
December 2025View printable summary
Dec
31

B
you paid
£10.00you lent Bob
£5.00`);
    expect(expenses.map((e) => e.date)).toEqual(['2026-01-02', '2025-12-31']);
  });

  it('needs no refund special case: the payer rule gives the right sign', () => {
    const { expenses } = parseSplitwise(`October 2026View printable summary
Oct
18

Cabin flights refund 
you paid
£440.00you lent Priya
£220.00
Oct
17

Hotel refund
Priya N. paid
£100.00Priya lent you
£50.00`);
    expect(expenses.map((e) => e.amount)).toEqual([220, -50]);
  });

  it('tracks owed money for a full anonymised paste', () => {
    const { expenses, warnings } = parseSplitwise(`November 2026View printable summary
Nov
01

Food
you paid
£68.00you lent Priya
£23.00
October 2026View printable summary
Oct
25

Cabin trip stuff 
Priya N. paid
£28.89Priya lent you
£28.89
Oct
19

Online order
you paid
£29.99you lent Priya
£29.99
Oct
18

Cabin flights refund 
you paid
£440.00you lent Priya
£220.00
Oct
12

Burgers
Priya N. paid
£28.00Priya lent you
£14.00`);
    expect(expenses.map((e) => [e.date, e.description, e.amount])).toEqual([
      ['2026-11-01', 'Food', 23],
      ['2026-10-25', 'Cabin trip stuff', -28.89],
      ['2026-10-19', 'Online order', 29.99],
      ['2026-10-18', 'Cabin flights refund', 220],
      ['2026-10-12', 'Burgers', -14],
    ]);
    expect(warnings).toEqual([]);
  });
});
