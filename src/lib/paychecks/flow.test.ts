import { describe, expect, it } from 'vitest';
import { makeTransactions } from '../metrics/testing';
import { buildMoneyFlow, flowWindow, type MoneyFlow } from './flow';
import type { Paycheck } from './paychecks';

const payslip = (month: string, over: Partial<Paycheck> = {}): Paycheck => ({
  id: `p-${month}`,
  date: `${month}-15`,
  income: [
    { id: 'l1', name: 'Salary', amount: 2800 },
    { id: 'l2', name: 'Allowance', amount: 200 },
  ],
  deductions: [
    { id: 'l1', name: 'Income tax', amount: 500 },
    { id: 'l2', name: 'Student loan', amount: 100 },
  ],
  ...over,
});

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
    if (into > 0 && out > 0) expect(into).toBeCloseTo(out, 2);
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
  const paychecks = [payslip('2026-01'), payslip('2026-02')];

  it('follows each income line through gross pay, deductions and take-home into spending', () => {
    const flow = buildMoneyFlow({ paychecks, ledgers, from: '2026-01', to: '2026-02' })!;
    expect(flow.totals).toEqual({ gross: 6000, deductions: 1200, takeHome: 4800, spending: 2000 });
    expect(value(flow, 'income:salary', 'gross')).toBe(5600);
    expect(value(flow, 'income:allowance', 'gross')).toBe(400);
    expect(value(flow, 'gross', 'deduction:income tax')).toBe(1000);
    expect(value(flow, 'gross', 'deduction:student loan')).toBe(200);
    expect(value(flow, 'gross', 'takeHome')).toBe(4800);
    expect(value(flow, 'takeHome', 'category:Rent')).toBe(1600);
    expect(value(flow, 'takeHome', 'category:Food')).toBe(400);
    expect(value(flow, 'takeHome', 'saved')).toBe(2800);
    expect(flow.nodes.filter((n) => n.column === 3).map((n) => n.label)).toEqual([
      'Rent',
      'Food',
      'Saved',
    ]);
    balanced(flow);
  });

  it('needs no account for take-home pay', () => {
    const two = [...ledgers, { account: { id: 2, name: 'Savings' }, transactions: [] }];
    const flow = buildMoneyFlow({ paychecks, ledgers: two, from: '2026-01', to: '2026-02' })!;
    expect(flow.nodes.some((n) => n.id.startsWith('account'))).toBe(false);
    expect(flow.totals.takeHome).toBe(4800);
  });

  it('counts only the months in the window', () => {
    const flow = buildMoneyFlow({ paychecks, ledgers, from: '2026-02', to: '2026-02' })!;
    expect(flow.totals.gross).toBe(3000);
    expect(value(flow, 'takeHome', 'category:Rent')).toBe(800);
  });

  it('counts spending from the chosen accounts only', () => {
    const two = [
      current([['2026-01-26', -10, 'Food']]),
      {
        account: { id: 2, name: 'Savings' },
        transactions: makeTransactions(2, [['2026-01-26', -70, 'Fees']]),
      },
    ];
    const flow = buildMoneyFlow({
      paychecks,
      ledgers: two,
      from: '2026-01',
      to: '2026-01',
      accountIds: [2],
    })!;
    expect(flow.totals.spending).toBe(70);
  });

  it('shows spending beyond take-home as other income', () => {
    const poor = [current([['2026-01-26', -3000, 'Holiday']])];
    const flow = buildMoneyFlow({
      paychecks,
      ledgers: poor,
      from: '2026-01',
      to: '2026-01',
    })!;
    expect(value(flow, 'other', 'takeHome')).toBe(600);
    expect(flow.nodes.some((n) => n.id === 'saved')).toBe(false);
    balanced(flow);
  });

  it('merges lines with the same name across months, ignoring case', () => {
    const second = payslip('2026-02', {
      deductions: [{ id: 'x', name: 'income TAX', amount: 50 }],
    });
    const flow = buildMoneyFlow({
      paychecks: [payslip('2026-01'), second],
      ledgers,
      from: '2026-01',
      to: '2026-02',
    })!;
    expect(flow.nodes.filter((n) => n.kind === 'deduction')).toHaveLength(2);
    expect(value(flow, 'gross', 'deduction:income tax')).toBe(550);
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
    const flow = buildMoneyFlow({ paychecks, ledgers: two, from: '2026-01', to: '2026-01' })!;
    expect(flow.totals.spending).toBe(20);
  });

  it('is null without a paycheck in the window or without accounts', () => {
    expect(buildMoneyFlow({ paychecks: [], ledgers, from: '2026-01', to: '2026-02' })).toBeNull();
    expect(buildMoneyFlow({ paychecks, ledgers, from: '2025-01', to: '2025-12' })).toBeNull();
    expect(buildMoneyFlow({ paychecks, ledgers: [], from: '2026-01', to: '2026-02' })).toBeNull();
  });
});

describe('flowWindow', () => {
  const ledgers = [current([['2026-02-01', 1]])];
  it('ends at the latest month with data', () => {
    expect(flowWindow(ledgers, [payslip('2026-01')], 3, '2026-10-18')).toEqual({
      from: '2025-12',
      to: '2026-02',
    });
  });
  it('starts at the earliest data or paycheck for all', () => {
    expect(flowWindow(ledgers, [payslip('2025-06')], 'all', '2026-10-18')).toEqual({
      from: '2025-06',
      to: '2026-02',
    });
  });
  it('ends this month without transactions', () => {
    expect(flowWindow([], [payslip('2026-01')], 6, '2026-10-18')).toEqual({
      from: '2026-05',
      to: '2026-10',
    });
  });
});
