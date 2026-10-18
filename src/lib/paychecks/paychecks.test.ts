import { describe, expect, it } from 'vitest';
import {
  addPaycheck,
  netPay,
  newDeduction,
  newPaycheck,
  paycheckProblem,
  paymentDates,
  removePaycheck,
  replacePaycheck,
  tidyPaycheck,
  type Paycheck,
} from './paychecks';
import { parsePaychecks, serializePaychecks } from './serialize';

const salary = (overrides: Partial<Paycheck> = {}): Paycheck => ({
  id: 'p1',
  name: 'Acme',
  date: '2026-01-31',
  gross: 3000,
  deductions: [
    { id: 'd1', name: 'Income tax', amount: 600.1 },
    { id: 'd2', name: 'Student loan', amount: 150.2 },
  ],
  accountId: 1,
  repeat: 'monthly',
  until: null,
  ...overrides,
});

describe('paycheck maths', () => {
  it('takes deductions off gross without float drift', () => {
    expect(netPay(salary())).toBe(2249.7);
    expect(netPay({ gross: 100, deductions: [] })).toBe(100);
  });

  it('edits the list', () => {
    let list = addPaycheck({ paychecks: [] }, newPaycheck([], '2026-02-01'));
    const id = list.paychecks[0]!.id;
    list = replacePaycheck(list, { ...list.paychecks[0]!, name: 'Job' });
    expect(list.paychecks[0]!.name).toBe('Job');
    expect(newPaycheck(list.paychecks, '2026-02-01').id).not.toBe(id);
    expect(removePaycheck(list, id).paychecks).toEqual([]);
    expect(newDeduction([{ id: 'd1', name: '', amount: 0 }]).id).toBe('d2');
  });

  it('explains what stops a paycheck being saved', () => {
    expect(paycheckProblem(salary())).toBeNull();
    expect(paycheckProblem(salary({ name: ' ' }))).toMatch(/name/);
    expect(paycheckProblem(salary({ gross: 0 }))).toMatch(/Gross/);
    expect(paycheckProblem(salary({ date: 'soon' }))).toMatch(/date/);
    expect(paycheckProblem(salary({ until: '2025-01-01' }))).toMatch(/before/);
    expect(paycheckProblem(salary({ deductions: [{ id: 'd', name: 'x', amount: 5000 }] }))).toMatch(
      /more than gross/
    );
    expect(paycheckProblem(salary({ deductions: [{ id: 'd', name: '', amount: 5 }] }))).toMatch(
      /Name every/
    );
  });

  it('tidies blank deduction lines', () => {
    const tidy = tidyPaycheck(
      salary({
        name: ' Acme ',
        deductions: [
          { id: 'a', name: '', amount: 0 },
          { id: 'b', name: ' Pension ', amount: 10 },
        ],
      })
    );
    expect(tidy.name).toBe('Acme');
    expect(tidy.deductions).toEqual([{ id: 'b', name: 'Pension', amount: 10 }]);
  });
});

describe('paymentDates', () => {
  it('pays once', () => {
    const once = salary({ repeat: 'none', date: '2026-03-10' });
    expect(paymentDates(once, '2026-03-01', '2026-03-31')).toEqual(['2026-03-10']);
    expect(paymentDates(once, '2026-04-01', '2026-04-30')).toEqual([]);
  });

  it('keeps the day of the month, using the last day of short months', () => {
    expect(paymentDates(salary(), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('repeats weekly, fortnightly and four-weekly from the first payment', () => {
    const weekly = salary({ repeat: 'weekly', date: '2026-01-02' });
    expect(paymentDates(weekly, '2026-01-10', '2026-01-31')).toEqual([
      '2026-01-16',
      '2026-01-23',
      '2026-01-30',
    ]);
    const fortnightly = salary({ repeat: 'every2weeks', date: '2026-01-02' });
    expect(paymentDates(fortnightly, '2026-02-01', '2026-02-28')).toEqual([
      '2026-02-13',
      '2026-02-27',
    ]);
    const fourWeekly = salary({ repeat: 'every4weeks', date: '2026-01-02' });
    expect(paymentDates(fourWeekly, '2026-01-01', '2026-03-01')).toEqual([
      '2026-01-02',
      '2026-01-30',
      '2026-02-27',
    ]);
  });

  it('repeats yearly, and stops at the end date', () => {
    const yearly = salary({ repeat: 'yearly', date: '2024-02-29' });
    expect(paymentDates(yearly, '2024-01-01', '2026-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
    ]);
    expect(paymentDates(salary({ until: '2026-03-15' }), '2026-01-01', '2026-12-31')).toHaveLength(
      2
    );
  });

  it('does not pay before the first payment', () => {
    expect(paymentDates(salary(), '2025-01-01', '2025-12-31')).toEqual([]);
  });
});

describe('stored paychecks', () => {
  it('round-trips', () => {
    const list = { paychecks: [salary(), salary({ id: 'p2', repeat: 'none', until: null })] };
    const stored = JSON.parse(JSON.stringify(serializePaychecks(list)));
    expect(parsePaychecks(stored)).toEqual(list);
  });

  it('is empty when missing or unreadable', () => {
    expect(parsePaychecks(null)).toEqual({ paychecks: [] });
    expect(parsePaychecks('nonsense')).toEqual({ paychecks: [] });
    expect(parsePaychecks({ paychecks: 3 })).toEqual({ paychecks: [] });
  });

  it('drops bad paychecks and repairs bad fields', () => {
    const { paychecks } = parsePaychecks({
      paychecks: [
        { id: 'a', date: 'x', gross: 10 },
        { id: 'b', date: '2026-01-01', gross: 0 },
        { date: '2026-01-01', gross: 10 },
        {
          id: 'c',
          date: '2026-01-01',
          gross: 10,
          repeat: 'sometimes',
          accountId: 'x',
          until: 'later',
          deductions: [
            { name: 'Tax', amount: 2 },
            { name: 'Tax', amount: 1 },
            { name: 'Bad', amount: -1 },
            'nope',
          ],
        },
        { id: 'c', date: '2026-02-01', gross: 20 },
      ],
    });
    expect(paychecks).toEqual([
      {
        id: 'c',
        name: '',
        date: '2026-01-01',
        gross: 10,
        deductions: [
          { id: 'd1', name: 'Tax', amount: 2 },
          { id: 'd2', name: 'Tax', amount: 1 },
        ],
        accountId: null,
        repeat: 'none',
        until: null,
      },
    ]);
  });
});
