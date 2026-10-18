import { describe, expect, it } from 'vitest';
import {
  addPaycheck,
  copyPaycheck,
  netPay,
  nextMonth,
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

const payslip = (month: string, over: Partial<Paycheck> = {}): Paycheck => ({
  month,
  income: [
    { id: 'l1', name: 'Salary', amount: 3000 },
    { id: 'l2', name: 'Allowance', amount: 200 },
  ],
  deductions: [
    { id: 'l1', name: 'Income tax', amount: 500 },
    { id: 'l2', name: 'Pension', amount: 150.1 },
  ],
  ...over,
});

describe('totals', () => {
  it('derives take-home from income less deductions, to the cent', () => {
    expect(totalIncome(payslip('2026-01'))).toBe(3200);
    expect(totalDeductions(payslip('2026-01'))).toBe(650.1);
    expect(netPay(payslip('2026-01'))).toBe(2549.9);
  });
});

describe('the list', () => {
  const list: PaycheckList = { paychecks: [payslip('2026-01'), payslip('2026-03')] };

  it('keeps entries in month order', () => {
    expect(addPaycheck(list, payslip('2026-02')).paychecks.map((p) => p.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('replaces by month, allowing the month to change', () => {
    const moved = replacePaycheck(list, '2026-01', payslip('2026-05'));
    expect(moved.paychecks.map((p) => p.month)).toEqual(['2026-03', '2026-05']);
  });

  it('removes by month', () => {
    expect(removePaycheck(list, '2026-03').paychecks.map((p) => p.month)).toEqual(['2026-01']);
  });

  it('starts the next entry the month after the latest, or this month when empty', () => {
    expect(nextMonth(list, '2026-10-18')).toBe('2026-04');
    expect(nextMonth({ paychecks: [] }, '2026-10-18')).toBe('2026-10');
  });
});

describe('copyPaycheck', () => {
  it('copies the latest earlier month with fresh ids', () => {
    const list = {
      paychecks: [
        payslip('2026-01', { income: [{ id: 'x', name: 'Old', amount: 1 }] }),
        payslip('2026-02'),
      ],
    };
    const copy = copyPaycheck(list, '2026-03');
    expect(copy.month).toBe('2026-03');
    expect(copy.income.map((l) => [l.name, l.amount])).toEqual([
      ['Salary', 3000],
      ['Allowance', 200],
    ]);
    expect(copy.income).not.toBe(list.paychecks[1]!.income);
  });

  it('is empty when there is nothing to copy', () => {
    expect(copyPaycheck({ paychecks: [] }, '2026-03')).toEqual({
      month: '2026-03',
      income: [],
      deductions: [],
    });
  });
});

describe('suggestedNames', () => {
  it('lists names used before, most used first, one spelling each', () => {
    const list = {
      paychecks: [
        payslip('2026-01', { deductions: [{ id: 'a', name: 'Tax', amount: 1 }] }),
        payslip('2026-02', {
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
    expect(paycheckProblem(payslip('2026-01'))).toBeNull();
  });

  it('explains what is wrong', () => {
    expect(paycheckProblem(payslip('nope'))).toMatch(/month/);
    expect(paycheckProblem(payslip('2026-01'), ['2026-01'])).toMatch(/already/);
    expect(paycheckProblem(payslip('2026-01', { income: [] }))).toMatch(/income/);
    expect(
      paycheckProblem(payslip('2026-01', { deductions: [{ id: 'a', name: '', amount: 5 }] }))
    ).toMatch(/Name/);
    expect(
      paycheckProblem(payslip('2026-01', { deductions: [{ id: 'a', name: 'Tax', amount: 9999 }] }))
    ).toMatch(/more than/);
    expect(
      paycheckProblem(payslip('2026-01', { deductions: [{ id: 'a', name: 'Tax', amount: -1 }] }))
    ).toMatch(/negative/);
  });
});

describe('tidyPaycheck', () => {
  it('drops blank lines and trims names', () => {
    const tidy = tidyPaycheck(
      payslip('2026-01', {
        income: [
          { id: 'a', name: '', amount: 0 },
          { id: 'b', name: ' Salary ', amount: 10 },
        ],
      })
    );
    expect(tidy.income).toEqual([{ id: 'b', name: 'Salary', amount: 10 }]);
  });
});
