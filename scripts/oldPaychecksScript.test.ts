import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** `old-paychecks-to-ledger.gs` is pasted into Apps Script by hand, so it is tested by loading it as plain JS. */
const source = readFileSync(join(__dirname, 'old-paychecks-to-ledger.gs'), 'utf8');
const Utilities = {
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
};
const { convertRows_ } = new Function('Utilities', `${source}; return { convertRows_ };`)(
  Utilities
) as {
  convertRows_(
    grid: unknown[][],
    tz: string
  ): {
    paychecks: { date: string; taxCode: string; lines: [string, string, number][] }[];
    warnings: string[];
  };
};

const HEADER = [
  'Date',
  'Tax Code',
  'Tax Year',
  'Total Income',
  'Pension (Salary Sacrifice)',
  'Pension (Employer)',
  'Taxable Benefits',
  'Income Tax',
  'NI',
  'Student Loan',
  'Donations',
  'Take Home',
];
// 5,000 - 250 - 700 - 300 - 150 - 50 = 3,550
const ROW = [
  '25/09/2026',
  '1257L',
  '2026/27',
  '5,000.00',
  250,
  400,
  120,
  700,
  300,
  150,
  50,
  '3,550.00',
];

describe('old-paychecks-to-ledger.gs', () => {
  it('turns a row into Income / Benefit in kind / Deduction lines', () => {
    const { paychecks, warnings } = convertRows_([HEADER, ROW], 'UTC');
    expect(paychecks).toEqual([
      {
        date: '2026-09-25',
        taxCode: '1257L',
        lines: [
          ['Income', 'Salary', 5000],
          ['Benefit in kind', 'Taxable benefits', 120],
          ['Deduction', 'Income tax', 700],
          ['Deduction', 'National Insurance', 300],
          ['Deduction', 'Student loan', 150],
          ['Deduction', 'Pension (salary sacrifice)', 250],
          ['Deduction', 'Donations', 50],
        ],
      },
    ]);
    expect(warnings).toEqual([expect.stringContaining('Pension (Employer)')]);
  });

  it('skips zeros, reads Date cells, and works without a header', () => {
    const row = [
      new Date('2026-10-25T00:00:00Z'),
      '1257L',
      '2026/27',
      2000,
      0,
      0,
      0,
      300,
      100,
      0,
      0,
      1600,
    ];
    const { paychecks, warnings } = convertRows_([row], 'UTC');
    expect(paychecks[0]!.lines.map((l) => l[1])).toEqual([
      'Salary',
      'Income tax',
      'National Insurance',
    ]);
    expect(warnings).toEqual([]);
  });

  it('warns on a take-home mismatch and drops a pension that is already off the income', () => {
    expect(convertRows_([HEADER, [...ROW.slice(0, 11), 3000]], 'UTC').warnings.join(' ')).toMatch(
      /does not match/
    );
    const r = convertRows_([HEADER, [...ROW.slice(0, 11), 3800]], 'UTC');
    expect(r.paychecks[0]!.lines.map((l) => l[1])).not.toContain('Pension (salary sacrifice)');
  });

  it('reads 13/02/2026 day first and skips unreadable rows', () => {
    const r = convertRows_([HEADER, ['13/02/2026', '', '', 100], ['junk', '', '', 100]], 'UTC');
    expect(r.paychecks.map((p) => p.date)).toEqual(['2026-02-13']);
    expect(r.warnings.join(' ')).toMatch(/no readable date/);
  });

  it('warns when two paychecks share a date', () => {
    const r = convertRows_([HEADER, ROW, ROW], 'UTC');
    expect(r.warnings.join(' ')).toMatch(/2026-09-25 has more than one paycheck/);
  });
});
