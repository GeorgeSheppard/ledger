import { describe, expect, it } from 'vitest';
import { makeTransactions } from '../metrics/testing';
import { allTime, buildMoneyFlow, type MoneyFlow } from './flow';
import type { Paycheck } from './paychecks';

const payslip = (month: string, over: Partial<Paycheck> = {}): Paycheck => ({
  id: `p-${month}`,
  date: `${month}-15`,
  income: [
    { id: 'l1', name: 'Salary', amount: 2800 },
    { id: 'l2', name: 'Allowance', amount: 200 },
  ],
  benefits: [],
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

  it('narrows to the picked categories and gathers the rest into one node', () => {
    const flow = buildMoneyFlow({
      paychecks,
      ledgers,
      from: '2026-01-01',
      to: '2026-02-28',
      categories: ['Food'],
    })!;
    expect(value(flow, 'takeHome', 'category:Food')).toBe(400);
    expect(flow.links.some((l) => l.target === 'category:Rent')).toBe(false);
    expect(value(flow, 'takeHome', 'rest')).toBe(4400);
    expect(flow.nodes.filter((n) => n.column === 3).map((n) => n.label)).toEqual([
      'Food',
      'Everything else',
    ]);
    expect(flow.totals.spending).toBe(400);
    balanced(flow);
  });

  it('follows each income line through gross pay, deductions and take-home into spending', () => {
    const flow = buildMoneyFlow({ paychecks, ledgers, from: '2026-01-01', to: '2026-02-28' })!;
    expect(flow.totals).toEqual({
      gross: 6000,
      deductions: 1200,
      takeHome: 4800,
      spending: 2000,
      saved: 2800,
      overspent: 0,
    });
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

  it('adds a benefit in kind to gross pay and tax but not to take-home pay', () => {
    const flow = buildMoneyFlow({
      paychecks: [
        payslip('2026-01', { benefits: [{ id: 'b', name: 'Health insurance', amount: 100 }] }),
      ],
      ledgers,
      from: '2026-01-01',
      to: '2026-01-31',
    })!;
    expect(flow.totals).toMatchObject({ gross: 3100, deductions: 600, takeHome: 2400 });
    expect(value(flow, 'benefit:health insurance', 'gross')).toBe(100);
    expect(value(flow, 'gross', 'benefits')).toBe(100);
    expect(value(flow, 'gross', 'takeHome')).toBe(2400);
    balanced(flow);
  });

  it('needs no account for take-home pay', () => {
    const two = [...ledgers, { account: { id: 2, name: 'Savings' }, transactions: [] }];
    const flow = buildMoneyFlow({ paychecks, ledgers: two, from: '2026-01-01', to: '2026-02-28' })!;
    expect(flow.nodes.some((n) => n.id.startsWith('account'))).toBe(false);
    expect(flow.totals.takeHome).toBe(4800);
  });

  it('counts only the months in the window', () => {
    const flow = buildMoneyFlow({ paychecks, ledgers, from: '2026-02-01', to: '2026-02-28' })!;
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
      from: '2026-01-01',
      to: '2026-01-31',
      accountIds: [2],
    })!;
    expect(flow.totals.spending).toBe(70);
  });

  it('measures Saved from the spending that has ribbons, not from refunds netted below zero', () => {
    const refunded = [
      current([
        ['2026-01-26', -500, 'Rent'],
        ['2026-01-27', 200, 'Shopping'],
      ]),
    ];
    const flow = buildMoneyFlow({
      paychecks,
      ledgers: refunded,
      from: '2026-01-01',
      to: '2026-01-31',
    })!;
    expect(flow.totals.spending).toBe(500);
    expect(flow.totals.saved).toBe(flow.totals.takeHome - 500);
    balanced(flow);
  });

  it('shows spending beyond take-home as other income', () => {
    const poor = [current([['2026-01-26', -3000, 'Holiday']])];
    const flow = buildMoneyFlow({
      paychecks,
      ledgers: poor,
      from: '2026-01-01',
      to: '2026-01-31',
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
      from: '2026-01-01',
      to: '2026-02-28',
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
    const flow = buildMoneyFlow({ paychecks, ledgers: two, from: '2026-01-01', to: '2026-01-31' })!;
    expect(flow.totals.spending).toBe(20);
  });

  it('stops at take-home pay without spending, and needs no accounts', () => {
    const flow = buildMoneyFlow({
      paychecks,
      ledgers: [],
      from: '2026-01-01',
      to: '2026-02-28',
      withSpending: false,
    })!;
    expect(flow.nodes.some((n) => n.kind === 'category' || n.kind === 'saved')).toBe(false);
    expect(flow.nodes.some((n) => n.kind === 'other')).toBe(false);
    expect(flow.totals.spending).toBe(0);
    expect(value(flow, 'gross', 'takeHome')).toBe(flow.totals.takeHome);
    balanced(flow);
  });

  it('is null without a paycheck in the window or without accounts', () => {
    expect(
      buildMoneyFlow({ paychecks: [], ledgers, from: '2026-01-01', to: '2026-02-28' })
    ).toBeNull();
    expect(buildMoneyFlow({ paychecks, ledgers, from: '2025-01-01', to: '2025-12-31' })).toBeNull();
    expect(
      buildMoneyFlow({ paychecks, ledgers: [], from: '2026-01-01', to: '2026-02-28' })
    ).toBeNull();
  });
});

describe('allTime', () => {
  it('runs from the earliest transaction or paycheck to today', () => {
    const ledgers = [current([['2026-02-01', 1]])];
    expect(allTime(ledgers, [payslip('2025-06')], '2026-10-18')).toEqual({
      from: '2025-06-15',
      to: '2026-10-18',
    });
    expect(allTime(ledgers, [], '2026-10-18').from).toBe('2026-02-01');
    expect(allTime([], [], '2026-10-18')).toEqual({ from: '2026-10-18', to: '2026-10-18' });
  });
});
