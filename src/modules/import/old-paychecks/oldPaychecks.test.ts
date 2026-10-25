import { describe, expect, it } from 'vitest';
import { netPay } from '../../../lib/paychecks/paychecks';
import { mergeImported, oldPaychecksImporter } from '.';

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
].join('\t');

// 5,000 - 250 - 700 - 300 - 150 - 50 = 3,550
const ROW = [
  '25/09/2026',
  '1257L',
  '2026/27',
  '5,000.00',
  '250',
  '400',
  '120',
  '700',
  '300',
  '150',
  '50',
  '3,550.00',
].join('\t');

const parse = (text: string) => oldPaychecksImporter.parse({ name: 'Pasted text', text });

describe('oldPaychecksImporter', () => {
  it('maps a pasted row to income, benefit in kind and deductions', () => {
    const { paychecks, warnings } = parse(`${HEADER}\n${ROW}`);
    expect(paychecks).toHaveLength(1);
    const p = paychecks[0]!;
    expect(p.date).toBe('2026-09-25');
    expect(p.income).toEqual([{ id: 'l1', name: 'Salary', amount: 5000 }]);
    expect(p.benefits).toEqual([{ id: 'l1', name: 'Taxable benefits', amount: 120 }]);
    expect(p.deductions.map((d) => [d.name, d.amount])).toEqual([
      ['Income tax', 700],
      ['National Insurance', 300],
      ['Student loan', 150],
      ['Pension (salary sacrifice)', 250],
      ['Donations', 50],
    ]);
    expect(netPay(p)).toBe(3550);
    // Only the employer pension note: take-home reconciles.
    expect(warnings).toEqual([expect.stringContaining('Pension (Employer)')]);
  });

  it('skips zero amounts and reads CSV with quoted thousands', () => {
    const csv = `${HEADER.replaceAll('\t', ',')}\n2026-10-25,1257L,2026/27,"2,000.00",0,0,0,300,100,0,0,"1,600.00"`;
    const { paychecks, warnings } = parse(csv);
    const p = paychecks[0]!;
    expect(p.benefits).toEqual([]);
    expect(p.deductions.map((d) => d.name)).toEqual(['Income tax', 'National Insurance']);
    expect(warnings).toEqual([]);
  });

  it('works without a header row, in the old sheet order', () => {
    expect(parse(ROW).paychecks[0]!.deductions).toHaveLength(5);
  });

  it('warns when take-home does not match', () => {
    const { warnings } = parse(`${HEADER}\n${ROW.replace('3,550.00', '3,000.00')}`);
    expect(warnings.join(' ')).toMatch(/does not match the Take Home column £3,000.00/);
  });

  it('leaves the pension out when it was already off Total Income', () => {
    const { paychecks, warnings } = parse(`${HEADER}\n${ROW.replace('3,550.00', '3,800.00')}`);
    expect(paychecks[0]!.deductions.map((d) => d.name)).not.toContain('Pension (salary sacrifice)');
    expect(netPay(paychecks[0]!)).toBe(3800);
    expect(warnings.join(' ')).toMatch(/only adds up without the salary-sacrifice pension/);
  });

  it('skips unreadable rows and throws when nothing is left', () => {
    const { paychecks, warnings } = parse(`${HEADER}\n${ROW}\nnot a date\t\t\t100`);
    expect(paychecks).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/no readable date/);
    expect(() => parse(HEADER)).toThrow();
  });
});

describe('mergeImported', () => {
  it('adds with fresh ids, oldest first, and skips what is already there', () => {
    const { paychecks } = parse(`${HEADER}\n${ROW}\n${ROW.replace('25/09', '25/08')}`);
    const once = mergeImported({ paychecks: [] }, paychecks);
    expect(once.added).toBe(2);
    expect(once.list.paychecks.map((p) => p.date)).toEqual(['2026-08-25', '2026-09-25']);
    expect(new Set(once.list.paychecks.map((p) => p.id)).size).toBe(2);
    const twice = mergeImported(once.list, paychecks);
    expect(twice).toMatchObject({ added: 0, skipped: 2 });
  });
});
