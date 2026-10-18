import { describe, expect, it } from 'vitest';
import { parsePaychecks, serializePaychecks } from './serialize';

const TODAY = '2026-06-15';

const legacy = (paychecks: unknown[]) => ({ version: 1, paychecks });

describe('parsePaychecks (version 2)', () => {
  it('round-trips', () => {
    const list = {
      paychecks: [
        {
          month: '2026-01',
          income: [{ id: 'l1', name: 'Salary', amount: 3000 }],
          deductions: [{ id: 'l1', name: 'Tax', amount: 600 }],
        },
      ],
    };
    expect(parsePaychecks(serializePaychecks(list), TODAY)).toEqual(list);
    expect(serializePaychecks(list).version).toBe(2);
  });

  it('is empty for nothing or junk, and drops what it cannot read', () => {
    expect(parsePaychecks(null, TODAY)).toEqual({ paychecks: [] });
    expect(parsePaychecks('x', TODAY)).toEqual({ paychecks: [] });
    const parsed = parsePaychecks(
      {
        version: 2,
        paychecks: [
          { month: '2026-13', income: [], deductions: [] },
          {
            month: '2026-02',
            income: [{ name: 'A', amount: 1 }, { name: 'B', amount: -1 }, 7],
            deductions: 'x',
          },
          { month: '2026-02', income: [], deductions: [] },
          {
            month: '2026-01',
            income: [
              { id: 'l1', name: 'S', amount: 2 },
              { id: 'l1', name: 'T', amount: 3 },
            ],
          },
        ],
      },
      TODAY
    );
    expect(parsed.paychecks.map((p) => p.month)).toEqual(['2026-01', '2026-02']);
    expect(parsed.paychecks[1]!.income).toEqual([{ id: 'l1', name: 'A', amount: 1 }]);
    expect(parsed.paychecks[1]!.deductions).toEqual([]);
    expect(parsed.paychecks[0]!.income.map((l) => l.id)).toEqual(['l1', 'l1_']);
  });
});

describe('migrating version 1', () => {
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

  it('turns a one-off paycheck into one month, dropping the account', () => {
    const { paychecks } = parsePaychecks(
      legacy([{ ...salary, repeat: 'none', accountId: 7 }]),
      TODAY
    );
    expect(paychecks).toEqual([
      {
        month: '2026-01',
        income: [{ id: 'l1', name: 'Acme', amount: 3000 }],
        deductions: [
          { id: 'l1', name: 'Income tax', amount: 500 },
          { id: 'l2', name: 'Pension', amount: 100 },
        ],
      },
    ]);
  });

  it('runs an open-ended monthly paycheck up to this month', () => {
    const months = parsePaychecks(legacy([salary]), TODAY).paychecks.map((p) => p.month);
    expect(months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  });

  it('stops at the last payment date', () => {
    const months = parsePaychecks(legacy([{ ...salary, until: '2026-03-31' }]), TODAY).paychecks;
    expect(months.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('adds up weekly payments in a month and treats a missing version as version 1', () => {
    const { paychecks } = parsePaychecks(
      {
        paychecks: [
          { ...salary, gross: 100, deductions: [], repeat: 'weekly', date: '2026-06-01' },
        ],
      },
      TODAY
    );
    expect(paychecks).toHaveLength(1);
    // 1st, 8th and 15th of June.
    expect(paychecks[0]!.income[0]!.amount).toBe(300);
  });

  it('combines two jobs in one month and merges same-named deductions', () => {
    const { paychecks } = parsePaychecks(
      legacy([
        { ...salary, repeat: 'none' },
        {
          ...salary,
          id: 'p2',
          name: 'Cafe',
          gross: 400,
          repeat: 'none',
          deductions: [{ id: 'x', name: 'income TAX', amount: 20 }],
        },
      ]),
      TODAY
    );
    expect(paychecks).toHaveLength(1);
    expect(paychecks[0]!.income.map((l) => [l.name, l.amount])).toEqual([
      ['Acme', 3000],
      ['Cafe', 400],
    ]);
    expect(paychecks[0]!.deductions[0]).toMatchObject({ name: 'Income tax', amount: 520 });
  });

  it('skips paychecks it cannot read', () => {
    expect(
      parsePaychecks(legacy([{ id: 'p', name: 'x', date: 'bad', gross: 5 }, 3]), TODAY)
    ).toEqual({
      paychecks: [],
    });
  });

  it('is written back as version 2', () => {
    const list = parsePaychecks(legacy([{ ...salary, repeat: 'none' }]), TODAY);
    expect(serializePaychecks(list).version).toBe(2);
    expect(parsePaychecks(serializePaychecks(list), TODAY)).toEqual(list);
  });
});
