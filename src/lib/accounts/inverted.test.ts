import { describe, expect, it } from 'vitest';
import { periodCashFlow } from '../metrics/dashboard';
import { monthPeriod } from '../metrics/period';
import { MemoryCache } from '../store/cache';
import { planBalanceAdjustment } from '../transactions/adjustment';
import { toSnapshot, type LedgerData } from '../store/ledgerData';
import { LedgerStore } from '../store/ledgerStore';
import { MemoryRemote } from '../store/remote';
import { filterTransactions, noFilters } from '../transactions/filters';
import { toMoneyTerms, toSheetTerms } from './inverted';

/** A current account and a credit card, as the sheet has them: the card writes purchases positive. */
function sheet(): LedgerData {
  return {
    accounts: [
      { id: 1, name: 'Current' },
      { id: 2, name: 'Visa', inverted: true },
    ],
    rows: {
      1: [
        { date: '2026-03-01', category: 'Salary', amount: 2000, note: '' },
        { date: '2026-03-10', category: 'Card payment', amount: -80, note: '' },
      ],
      2: [
        { date: '2026-03-05', category: 'Groceries', amount: 50, note: 'Purchase' },
        { date: '2026-03-06', category: 'Refund', amount: -20, note: 'Refund' },
        { date: '2026-03-10', category: 'Card payment', amount: -80, note: 'Payment' },
        { date: '2026-03-11', category: '', amount: 0, note: 'Zero' },
      ],
    },
    categories: [],
    paychecks: null,
  };
}

async function open(remote = new MemoryRemote(sheet())) {
  const store = await LedgerStore.open({ spreadsheetId: 's', remote, cache: new MemoryCache() });
  return { store, remote };
}

describe('inverted accounts', () => {
  it('flips only inverted accounts, and flipping back restores the sheet', () => {
    const money = toMoneyTerms(sheet());
    expect(money.rows[1]).toEqual(sheet().rows[1]);
    expect(money.rows[2]!.map((r) => r.amount)).toEqual([-50, 20, 80, 0]);
    expect(Object.is(money.rows[2]![3]!.amount, 0)).toBe(true);
    expect(toSheetTerms(money)).toEqual(sheet());
  });

  it('loads in money terms and saves the sheet its own signs back', async () => {
    const { store, remote } = await open();
    const snap = store.getSnapshot();
    expect(snap.transactionsByAccount[2]!.map((t) => t.amount)).toEqual([-50, 20, 80, 0]);
    // The running Total follows money terms: the card shows what is owed as negative.
    expect(snap.transactionsByAccount[2]!.at(-1)!.total).toBe(50);

    await store.addTransactions(2, [
      { date: '2026-03-12', category: 'Fuel', amount: -30, note: '' },
    ]);
    await store.save();
    expect(remote.data.rows[2]!.map((r) => r.amount)).toEqual([50, -20, -80, 0, 30]);
    expect(remote.data.rows[1]).toEqual(sheet().rows[1]);
  });

  it('marking an account a card keeps the sheet as it is', async () => {
    const data = sheet();
    data.accounts[1] = { id: 2, name: 'Visa' };
    data.rows[2] = sheet().rows[2]!.map((r) => ({ ...r, amount: r.amount === 0 ? 0 : -r.amount })); // already money terms
    const { store, remote } = await open(new MemoryRemote(data));
    const before = remote.data.rows[2];
    await store.setAccountInverted(2, true);
    expect(store.getSnapshot().transactionsByAccount[2]!.map((t) => t.amount)).toEqual([
      50, -20, -80, 0,
    ]);
    await store.save();
    expect(remote.data.rows[2]).toEqual(before);
    expect(remote.data.accounts[1]!.inverted).toBe(true);
  });

  it('reads an old browser copy (sheet signs, no marker) without mixing conventions', async () => {
    const cache = new MemoryCache();
    const remote = new MemoryRemote(sheet());
    const edited = sheet();
    edited.rows[2] = [
      ...edited.rows[2]!,
      { date: '2026-03-12', category: '', amount: 30, note: 'Old' },
    ];
    await cache.put('s', { saved: { ...(await remote.load()) }, current: edited });
    const store = await LedgerStore.open({ spreadsheetId: 's', remote, cache });
    expect(store.getSnapshot().transactionsByAccount[2]!.at(-1)!.amount).toBe(-30);
    await store.save();
    expect(remote.data.rows[2]!.at(-1)!.amount).toBe(30);
  });

  it('the Money in and Money out filters work on a card', async () => {
    const { store } = await open();
    const rows = store.getSnapshot().transactionsByAccount[2]!;
    const notes = (sign: 'in' | 'out') =>
      filterTransactions(rows, { ...noFilters, sign }).map((t) => t.note);
    expect(notes('out')).toEqual(['Purchase']);
    expect(notes('in')).toEqual(['Refund', 'Payment']);
  });

  it('the dashboard counts card purchases as spending, not income, and the payment as a transfer', async () => {
    const { store } = await open();
    const snap = store.getSnapshot();
    const ledgers = snap.accounts.map((account) => ({
      account,
      transactions: snap.transactionsByAccount[account.id] ?? [],
    }));
    const flow = periodCashFlow(ledgers, [1, 2], monthPeriod('2026-03'));
    expect(flow.income).toBe(2020); // salary and the refund, exactly as on a current account
    expect(flow.spending).toBe(50); // the purchase; the 80 card payment is a transfer, not spending
    expect(toSnapshot(toMoneyTerms(sheet()), []).transactionsByAccount[2]).toHaveLength(4);
  });

  it('a balance adjustment on a card is written with the sheet side sign', async () => {
    const { store, remote } = await open();
    const rows = store.getSnapshot().transactionsByAccount[2]!;
    // Money terms: the card is 50 in credit. The bank says 70 is owed.
    const plan = planBalanceAdjustment(rows, '2026-03-11', -70)!;
    expect(plan.current).toBe(50);
    expect(plan.input.amount).toBe(-120);
    await store.addTransactions(2, [plan.input]);
    await store.save();
    expect(remote.data.rows[2]!.at(-1)).toMatchObject({ note: 'Balance adjustment', amount: 120 });
  });
});
