import { describe, expect, it } from 'vitest';
import { parsePaychecks, serializePaychecks } from './serialize';

const TODAY = '2026-06-15';

describe('parsePaychecks (version 3)', () => {
  it('round-trips', () => {
    const list = {
      paychecks: [
        {
          id: 'p1',
          date: '2026-01-25',
          income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
          deductions: [{ id: 'l1', name: 'Tax', amount: 600 }],
        },
      ],
    };
    expect(parsePaychecks(serializePaychecks(list), TODAY)).toEqual(list);
    expect(serializePaychecks(list).version).toBe(3);
  });

  it('is empty for nothing or junk, and repairs or drops what it cannot read', () => {
    expect(parsePaychecks(null, TODAY)).toEqual({ paychecks: [] });
    expect(parsePaychecks('x', TODAY)).toEqual({ paychecks: [] });
    const parsed = parsePaychecks(
      {
        version: 3,
        paychecks: [
          { id: 'a', date: 'nope', income: [], deductions: [] },
          {
            id: 'b',
            date: '2026-02-25',
            income: [{ name: 'A', amount: 1 }, { name: 'B', amount: -1 }, 7],
            deductions: 'x',
          },
          { id: 'b', date: '2026-02-25', income: [], deductions: [] },
          {
            date: '2026-01-25',
            income: [
              { id: 'l1', name: 'S', amount: 2 },
              { id: 'l1', name: 'T', amount: 3 },
            ],
          },
        ],
      },
      TODAY
    );
    expect(parsed.paychecks.map((p) => p.date)).toEqual(['2026-01-25', '2026-02-25', '2026-02-25']);
    expect(new Set(parsed.paychecks.map((p) => p.id)).size).toBe(3);
    expect(parsed.paychecks[1]!.income).toEqual([{ id: 'l1', name: 'A', amount: 1 }]);
    expect(parsed.paychecks[0]!.income.map((l) => l.id)).toEqual(['l1', 'l1_']);
  });
});

describe('migrating version 2 (one payslip per month)', () => {
  it('dates each payslip on the last day of its month', () => {
    const { paychecks } = parsePaychecks(
      {
        version: 2,
        paychecks: [
          {
            month: '2026-02',
            income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
            deductions: [{ id: 'l1', name: 'Tax', amount: 600 }],
          },
          { month: '2026-13', income: [], deductions: [] },
        ],
      },
      TODAY
    );
    expect(paychecks).toHaveLength(1);
    expect(paychecks[0]).toMatchObject({
      date: '2026-02-28',
      income: [{ name: 'Salary', amount: 3000 }],
      deductions: [{ name: 'Tax', amount: 600 }],
    });
  });
});

describe('migrating version 1 (a schedule)', () => {
  const legacy = (paychecks: unknown[]) => ({ version: 1, paychecks });
  const salary = {
    id: 'p1',
    name: 'Acme',
    date: '2026-01-25',
    gross: 3000,
    deductions: [
      { id: 'd1', name: 'Income tax', amount: 500 },
      { id: 'd2', name: 'Pension', amount: 100 },
    ],
    accountId: 1,
    repeat: 'monthly',
    until: null,
  };

  it('turns a one-off paycheck into one dated paycheck, dropping the account', () => {
    const { paychecks } = parsePaychecks(
      legacy([{ ...salary, repeat: 'none', accountId: 7 }]),
      TODAY
    );
    expect(paychecks).toEqual([
      {
        id: 'p1',
        date: '2026-01-25',
        income: [{ id: 'l1', name: 'Acme', amount: 3000 }],
        deductions: [
          { id: 'l1', name: 'Income tax', amount: 500 },
          { id: 'l2', name: 'Pension', amount: 100 },
        ],
      },
    ]);
  });

  it('makes one paycheck per payment, up to today when open-ended', () => {
    const dates = parsePaychecks(legacy([salary]), TODAY).paychecks.map((p) => p.date);
    expect(dates).toEqual(['2026-01-25', '2026-02-25', '2026-03-25', '2026-04-25', '2026-05-25']);
  });

  it('stops at the last payment date and keeps the day of month in short months', () => {
    const dates = parsePaychecks(
      legacy([{ ...salary, date: '2026-01-31', until: '2026-03-31' }]),
      TODAY
    ).paychecks.map((p) => p.date);
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('keeps every weekly payment and treats a missing version as version 1', () => {
    const { paychecks } = parsePaychecks(
      {
        paychecks: [
          { ...salary, gross: 100, deductions: [], repeat: 'weekly', date: '2026-06-01' },
        ],
      },
      TODAY
    );
    expect(paychecks.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15']);
  });

  it('skips paychecks it cannot read', () => {
    expect(
      parsePaychecks(legacy([{ id: 'p', name: 'x', date: 'bad', gross: 5 }, 3]), TODAY)
    ).toEqual({ paychecks: [] });
  });

  it('is written back as version 3', () => {
    const list = parsePaychecks(legacy([{ ...salary, repeat: 'none' }]), TODAY);
    expect(serializePaychecks(list).version).toBe(3);
    expect(parsePaychecks(serializePaychecks(list), TODAY)).toEqual(list);
  });
});
