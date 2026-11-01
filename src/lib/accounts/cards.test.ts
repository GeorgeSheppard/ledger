import { describe, expect, it } from 'vitest';
import { periodCashFlow } from '../metrics/dashboard';
import { monthPeriod } from '../metrics/period';
import { MemoryCache } from '../store/cache';
import type { LedgerData } from '../store/ledgerData';
import { LedgerStore } from '../store/ledgerStore';
import { MemoryRemote } from '../store/remote';
import { planBalanceAdjustment } from '../transactions/adjustment';
import { filterTransactions, noFilters } from '../transactions/filters';

/**
 * A credit card is an ordinary account. Ledger stores amounts one way for every account: positive
 * is money in, negative is money out, so a purchase is negative and the balance owed is negative.
 */
function sheet(): LedgerData {
  return {
    accounts: [
      { id: 1, name: 'Current' },
      { id: 2, name: 'Visa' },
    ],
    rows: {
      1: [
        { date: '2026-03-01', category: 'Salary', amount: 2000, note: '' },
        { date: '2026-03-10', category: 'Card payment', amount: -80, note: '' },
      ],
      2: [
        { date: '2026-03-05', category: 'Groceries', amount: -50, note: 'Purchase' },
        { date: '2026-03-06', category: 'Refund', amount: 20, note: 'Refund' },
        { date: '2026-03-10', category: 'Card payment', amount: 80, note: 'Payment' },
      ],
    },
    categories: [],
    paychecks: null,
  };
}

async function open() {
  const remote = new MemoryRemote(sheet());
  const store = await LedgerStore.open({ spreadsheetId: 's', remote, cache: new MemoryCache() });
  return { store, remote };
}

describe('a credit card account', () => {
  it('is written to the sheet exactly as it is in the app', async () => {
    const { store, remote } = await open();
    await store.addTransactions(2, [
      { date: '2026-03-12', category: 'Fuel', amount: -30, note: '' },
    ]);
    await store.save();
    expect(remote.data.rows[2]!.map((r) => r.amount)).toEqual([-50, 20, 80, -30]);
  });

  it('keeps a running total that goes negative when money is owed', async () => {
    const { store } = await open();
    const rows = store.getSnapshot().transactionsByAccount[2]!;
    expect(rows.map((t) => t.total)).toEqual([-50, -30, 50]);
  });

  it('works with the Money in and Money out filters', async () => {
    const { store } = await open();
    const rows = store.getSnapshot().transactionsByAccount[2]!;
    const notes = (sign: 'in' | 'out') =>
      filterTransactions(rows, { ...noFilters, sign }).map((t) => t.note);
    expect(notes('out')).toEqual(['Purchase']);
    expect(notes('in')).toEqual(['Refund', 'Payment']);
  });

  it('counts a purchase as spending, not income, and the payment as a transfer', async () => {
    const { store } = await open();
    const snap = store.getSnapshot();
    const ledgers = snap.accounts.map((account) => ({
      account,
      transactions: snap.transactionsByAccount[account.id] ?? [],
    }));
    const flow = periodCashFlow(ledgers, [1, 2], monthPeriod('2026-03'));
    expect(flow.income).toBe(2020); // salary and the refund, as on any account
    expect(flow.spending).toBe(50); // the purchase; the 80 payment is a transfer
  });

  it('takes a balance adjustment like any account', async () => {
    const { store, remote } = await open();
    const rows = store.getSnapshot().transactionsByAccount[2]!;
    // 50 in credit now; the bank says 70 is owed.
    const plan = planBalanceAdjustment(rows, '2026-03-11', -70)!;
    expect(plan.current).toBe(50);
    expect(plan.input.amount).toBe(-120);
    await store.addTransactions(2, [plan.input]);
    await store.save();
    expect(remote.data.rows[2]!.at(-1)).toMatchObject({ note: 'Balance adjustment', amount: -120 });
  });
});
