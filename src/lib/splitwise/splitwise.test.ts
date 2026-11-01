import { describe, expect, it } from 'vitest';
import { looksLikeSplitwise, parseSplitwise } from './splitwise';

const SAMPLE = `November 2026View printable summary
Nov
01

Food
you paid
£97.00you lent Anastasia
£31.00
October 2026View printable summary
Oct
25

Disneyland Paris stuff 
Anastasia W. paid
£28.89Anastasia lent you
£28.89
Oct
22

Food
you paid
£54.00you lent Anastasia
£18.00
Oct
19

Amazon order
you paid
£29.99you lent Anastasia
£29.99
`;

describe('parseSplitwise', () => {
  it('reads the user share of each expense', () => {
    const { expenses, warnings } = parseSplitwise(SAMPLE);
    expect(expenses).toEqual([
      { date: '2026-11-01', description: 'Food', spending: 66 },
      { date: '2026-10-25', description: 'Disneyland Paris stuff', spending: 28.89 },
      { date: '2026-10-22', description: 'Food', spending: 36 },
    ]);
    expect(warnings).toEqual([
      '1 Splitwise entry where you spent nothing (fully lent) was left out.',
    ]);
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
      { date: '2026-03-03', description: 'Flights', spending: 400.25 },
      { date: '2026-03-02', description: 'Rent', spending: 666.66 },
    ]);
  });

  it('leaves out settle-ups and expenses the user was not part of, and says so', () => {
    const { expenses, warnings } = parseSplitwise(`May 2026View printable summary
May
04

Payment
Anastasia W. paid
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
    expect(expenses).toEqual([{ date: '2026-05-02', description: 'Coffee', spending: 2 }]);
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
});
