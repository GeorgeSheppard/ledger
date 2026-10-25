import { describe, expect, it } from 'vitest';
import {
  addPaycheck,
  netPay,
  newPaycheck,
  paycheckProblem,
  removePaycheck,
  replacePaycheck,
  suggestedNames,
  tidyPaycheck,
  totalDeductions,
  totalIncome,
  type Paycheck,
  type PaycheckList,
} from './paychecks';

const payslip = (id: string, date = '2026-01-25', over: Partial<Paycheck> = {}): Paycheck => ({
  id,
  date,
  income: [
    { id: 'l1', name: 'Salary', amount: 3000 },
    { id: 'l2', name: 'Allowance', amount: 200 },
  ],
  benefits: [],
  deductions: [
    { id: 'l1', name: 'Income tax', amount: 500 },
    { id: 'l2', name: 'Pension', amount: 150.1 },
  ],
  ...over,
});

describe('totals', () => {
  it('derives take-home from income less deductions, to the cent', () => {
    expect(totalIncome(payslip('a'))).toBe(3200);
    expect(totalDeductions(payslip('a'))).toBe(650.1);
    expect(netPay(payslip('a'))).toBe(2549.9);
  });
});

describe('the list', () => {
  const list: PaycheckList = {
    paychecks: [payslip('a', '2026-01-25'), payslip('b', '2026-03-25')],
  };

  it('keeps entries in date order, and several can share a month', () => {
    const added = addPaycheck(
      addPaycheck(list, payslip('c', '2026-02-10')),
      payslip('d', '2026-03-01')
    );
    expect(added.paychecks.map((p) => p.id)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('replaces by id, allowing the date to change', () => {
    const moved = replacePaycheck(list, payslip('a', '2026-05-01'));
    expect(moved.paychecks.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('removes by id', () => {
    expect(removePaycheck(list, 'b').paychecks.map((p) => p.id)).toEqual(['a']);
  });

  it('starts a blank paycheck on the given day with an unused id', () => {
    expect(newPaycheck(list, '2026-10-18')).toEqual({
      id: 'p3',
      date: '2026-10-18',
      income: [],
      benefits: [],
      deductions: [],
    });
  });
});

describe('suggestedNames', () => {
  it('lists names used before, most used first, one spelling each', () => {
    const list = {
      paychecks: [
        payslip('a', '2026-01-25', { deductions: [{ id: 'a', name: 'Tax', amount: 1 }] }),
        payslip('b', '2026-02-25', {
          deductions: [
            { id: 'a', name: 'tax', amount: 1 },
            { id: 'b', name: 'Union', amount: 1 },
            { id: 'c', name: '', amount: 1 },
          ],
        }),
      ],
    };
    expect(suggestedNames(list, 'deductions')).toEqual(['tax', 'Union']);
    expect(suggestedNames(list, 'income')).toEqual(['Allowance', 'Salary']);
  });
});

describe('paycheckProblem', () => {
  it('accepts a normal payslip', () => {
    expect(paycheckProblem(payslip('a'))).toBeNull();
  });

  it('refuses a date another paycheck already has, but not its own', () => {
    const saved = [payslip('a', '2026-01-25'), payslip('b', '2026-02-25')];
    expect(paycheckProblem(payslip('b', '2026-01-25'), saved)).toMatch(/already a paycheck/);
    expect(paycheckProblem(payslip('b', '2026-03-25'), saved)).toBeNull();
    expect(paycheckProblem(payslip('b', '2026-02-25'), saved)).toBeNull();
  });

  it('explains what is wrong', () => {
    expect(paycheckProblem(payslip('a', 'nope'))).toMatch(/date/);
    expect(paycheckProblem(payslip('a', '2026-01-25', { income: [] }))).toMatch(/income/);
    expect(
      paycheckProblem(
        payslip('a', '2026-01-25', { deductions: [{ id: 'a', name: '', amount: 5 }] })
      )
    ).toMatch(/Name/);
    expect(
      paycheckProblem(
        payslip('a', '2026-01-25', { deductions: [{ id: 'a', name: 'Tax', amount: 9999 }] })
      )
    ).toMatch(/more than/);
    expect(
      paycheckProblem(
        payslip('a', '2026-01-25', { deductions: [{ id: 'a', name: 'Tax', amount: -1 }] })
      )
    ).toMatch(/negative/);
  });
});

describe('tidyPaycheck', () => {
  it('drops blank lines and trims names', () => {
    const tidy = tidyPaycheck(
      payslip('a', '2026-01-25', {
        income: [
          { id: 'a', name: '', amount: 0 },
          { id: 'b', name: ' Salary ', amount: 10 },
        ],
      })
    );
    expect(tidy.income).toEqual([{ id: 'b', name: 'Salary', amount: 10 }]);
  });
});
