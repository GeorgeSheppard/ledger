import { describe, expect, it } from 'vitest';
import { makeTransactions } from '../metrics/testing';
import { buildMoneyFlow, flowWindow, type MoneyFlow } from './flow';
import type { Paycheck } from './paychecks';

const salary: Paycheck = {
  id: 'p1',
  name: 'Acme',
  date: '2026-01-25',
  gross: 3000,
  deductions: [
    { id: 'd1', name: 'Income tax', amount: 500 },
    { id: 'd2', name: 'Student loan', amount: 100 },
  ],
  accountId: 1,
  repeat: 'monthly',
  until: null,
};

const current = (rows: Parameters<typeof makeTransactions>[1]) => ({
  account: { id: 1, name: 'Current' },
  transactions: makeTransactions(1, rows),
});

const value = (flow: MoneyFlow, source: string, target: string) =>
  flow.links.find((l) => l.source === source && l.target === target)?.value;

function balanced(flow: MoneyFlow) {
  for (const node of flow.nodes) {
    const into = flow.links.filter((l) => l.target === node.id).reduce((a, l) => a + l.value, 0);
    const out = flow.links.filter((l) => l.source === node.id).reduce((a, l) => a + l.value, 0);
    if (node.column > 0 && out > 0) expect(into).toBeCloseTo(out, 2);
    if (node.column < 3 && into > 0 && out > 0) expect(into).toBeCloseTo(out, 2);
  }
}

describe('buildMoneyFlow', () => {
  const ledgers = [
    current([
      ['2026-01-26', 2400],
      ['2026-01-27', -800, 'Rent'],
      ['2026-01-28', -300, 'Food'],
      ['2026-02-26', 2400],
      ['2026-02-27', -800, 'Rent'],
      ['2026-02-28', -100, 'Food'],
    ]),
  ];

  it('leaves excluded categories out of the spending side', () => {
    const flow = buildMoneyFlow({
      paychecks: [salary],
      ledgers,
      from: '2026-01',
      to: '2026-02',
      ignoredCategories: new Set(['rent']),
    })!;
    expect(flow.totals.spending).toBe(400);
    expect(flow.nodes.some((n) => n.category === 'Rent')).toBe(false);
    balanced(flow);
  });

  it('follows gross through deductions and take-home into accounts and categories', () => {
    const flow = buildMoneyFlow({ paychecks: [salary], ledgers, from: '2026-01', to: '2026-02' })!;
    expect(flow.totals).toEqual({ gross: 6000, deductions: 1200, takeHome: 4800, spending: 2000 });
    expect(value(flow, 'income:acme', 'deduction:income tax')).toBe(1000);
    expect(value(flow, 'income:acme', 'deduction:student loan')).toBe(200);
    expect(value(flow, 'income:acme', 'takeHome')).toBe(4800);
    expect(value(flow, 'takeHome', 'account:1')).toBe(4800);
    expect(value(flow, 'account:1', 'category:Rent')).toBe(1600);
    expect(value(flow, 'account:1', 'category:Food')).toBe(400);
    expect(value(flow, 'account:1', 'saved')).toBe(2800);
    expect(flow.nodes.filter((n) => n.column === 3).map((n) => n.label)).toEqual([
      'Rent',
      'Food',
      'Saved',
    ]);
    balanced(flow);
  });

  it('counts only payments inside the window', () => {
    const flow = buildMoneyFlow({ paychecks: [salary], ledgers, from: '2026-02', to: '2026-02' })!;
    expect(flow.totals.gross).toBe(3000);
    expect(value(flow, 'account:1', 'category:Rent')).toBe(800);
  });

  it('shows spending beyond take-home as other income', () => {
    const poor = [current([['2026-01-26', -3000, 'Holiday']])];
    const flow = buildMoneyFlow({
      paychecks: [salary],
      ledgers: poor,
      from: '2026-01',
      to: '2026-01',
    })!;
    expect(value(flow, 'other', 'account:1')).toBe(600);
    expect(flow.nodes.some((n) => n.id === 'saved')).toBe(false);
    balanced(flow);
  });

  it('merges deductions and sources with the same name', () => {
    const second = {
      ...salary,
      id: 'p2',
      deductions: [{ id: 'x', name: 'income TAX', amount: 50 }],
    };
    const flow = buildMoneyFlow({
      paychecks: [salary, second],
      ledgers,
      from: '2026-01',
      to: '2026-01',
    })!;
    expect(flow.nodes.filter((n) => n.kind === 'deduction')).toHaveLength(2);
    expect(value(flow, 'income:acme', 'deduction:income tax')).toBe(550);
  });

  it('sends take-home to the first account when the chosen one is gone, and filters accounts', () => {
    const two = [
      current([['2026-01-26', -10, 'Food']]),
      { account: { id: 2, name: 'Savings' }, transactions: [] },
    ];
    const lost = { ...salary, accountId: 99 };
    const flow = buildMoneyFlow({
      paychecks: [lost],
      ledgers: two,
      from: '2026-01',
      to: '2026-01',
    })!;
    expect(value(flow, 'takeHome', 'account:1')).toBe(2400);
    const savings = { ...salary, accountId: 2 };
    expect(
      buildMoneyFlow({
        paychecks: [savings],
        ledgers: two,
        from: '2026-01',
        to: '2026-01',
        accountIds: [1],
      })
    ).toBeNull();
  });

  it('ignores transfers between accounts', () => {
    const two = [
      current([
        ['2026-01-26', -500, ''],
        ['2026-01-27', -20, 'Food'],
      ]),
      {
        account: { id: 2, name: 'Savings' },
        transactions: makeTransactions(2, [['2026-01-26', 500]]),
      },
    ];
    const flow = buildMoneyFlow({
      paychecks: [salary],
      ledgers: two,
      from: '2026-01',
      to: '2026-01',
    })!;
    expect(flow.totals.spending).toBe(20);
  });

  it('is null without a paycheck in the window or without accounts', () => {
    expect(buildMoneyFlow({ paychecks: [], ledgers, from: '2026-01', to: '2026-02' })).toBeNull();
    expect(
      buildMoneyFlow({ paychecks: [salary], ledgers, from: '2025-01', to: '2025-12' })
    ).toBeNull();
    expect(
      buildMoneyFlow({ paychecks: [salary], ledgers: [], from: '2026-01', to: '2026-02' })
    ).toBeNull();
  });
});

describe('flowWindow', () => {
  const ledgers = [current([['2026-02-01', 1]])];
  it('ends at the latest month with data', () => {
    expect(flowWindow(ledgers, [salary], 3, '2026-10-18')).toEqual({
      from: '2025-12',
      to: '2026-02',
    });
  });
  it('starts at the earliest data or paycheck for all', () => {
    expect(flowWindow(ledgers, [{ ...salary, date: '2025-06-01' }], 'all', '2026-10-18')).toEqual({
      from: '2025-06',
      to: '2026-02',
    });
  });
  it('ends this month without transactions', () => {
    expect(flowWindow([], [salary], 6, '2026-10-18')).toEqual({ from: '2026-05', to: '2026-10' });
  });
});
