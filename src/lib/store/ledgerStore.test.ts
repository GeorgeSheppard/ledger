import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureData } from '../data/fixtures';
import { MemoryCache } from './cache';
import type { LedgerData } from './ledgerData';
import { LedgerStore } from './ledgerStore';
import { MemoryRemote } from './remote';

const input = (date: string, amount: number, note = '') => ({ date, category: '', amount, note });

async function open(data: LedgerData = fixtureData(), cache = new MemoryCache()) {
  const remote = new MemoryRemote(data, [{ title: 'Budget 2025', reason: 'Row 1 is not …' }]);
  const store = await LedgerStore.open({ spreadsheetId: 'sheet', remote, cache, now: () => 42 });
  return { store, remote, cache };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('LedgerStore', () => {
  it('builds missing categories from transactions and saves them', async () => {
    const data = fixtureData();
    data.categories = [];
    data.rows[1] = [{ date: '2026-01-01', category: 'Travel', amount: 5, note: '' }];
    const { store, remote } = await open(data);
    const categories = await store.listCategories();
    expect(categories.map((c) => c.name)).toContain('Travel');
    expect(categories.every((c) => /^#[0-9a-f]{6}$/.test(c.color))).toBe(true);
    expect(store.hasUnsavedChanges).toBe(true);
    await store.save();
    expect(remote.data.categories.map((c) => c.name)).toContain('Travel');
  });

  it('loads once and serves every read from memory', async () => {
    const { store, remote } = await open();
    await store.listAccounts();
    await store.listTransactions(1);
    await store.listCategories();
    expect(remote.loads).toBe(1);
    expect(store.getSnapshot().skippedTabs).toHaveLength(1);
    expect(store.getStatus()).toEqual({ state: 'saved', savedAt: null });
  });

  it('applies edits locally at once and notifies subscribers', async () => {
    const { store, remote } = await open();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();
    const [added] = await store.addTransactions(2, [input('2026-04-02', 10, 'gift')]);
    expect(added).toMatchObject({ row: 3, note: 'gift', total: 8010 });
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot()).not.toBe(before);
    // Untouched accounts keep the same array, so their components can skip re-rendering.
    expect(store.getSnapshot().transactionsByAccount[1]).toBe(before.transactionsByAccount[1]);
    expect(store.getStatus()).toEqual({ state: 'unsaved' });
    expect(remote.saves).toBe(0);
  });

  it('saves only when there are changes, and reports saving then saved', async () => {
    const { store, remote } = await open();
    await store.save();
    expect(remote.saves).toBe(0);
    await store.renameAccount(1, 'Main');
    const saving = store.save();
    expect(store.getStatus()).toEqual({ state: 'saving' });
    await saving;
    expect(remote.saves).toBe(1);
    expect(remote.data.accounts[0]!.name).toBe('Main');
    expect(store.getStatus()).toEqual({ state: 'saved', savedAt: 42 });
  });

  it('keeps edits made during a save as unsaved', async () => {
    const { store, remote } = await open();
    await store.renameAccount(1, 'A');
    const saving = store.save();
    await store.renameAccount(1, 'B');
    await saving;
    expect(remote.data.accounts[0]!.name).toBe('A');
    expect(store.getStatus().state).toBe('unsaved');
    await store.save();
    expect(remote.data.accounts[0]!.name).toBe('B');
  });

  it('reports a failed save and keeps the edits for the next one', async () => {
    const { store, remote } = await open();
    const realSave = remote.save.bind(remote);
    remote.save = async () => {
      throw new Error('Quota exceeded');
    };
    await store.renameAccount(1, 'Main');
    await expect(store.save()).rejects.toThrow('Quota exceeded');
    expect(store.getStatus()).toEqual({ state: 'error', message: 'Quota exceeded' });
    remote.save = realSave;
    await store.save();
    expect(store.getStatus().state).toBe('saved');
  });

  it('autosaves on an interval only when there are changes', async () => {
    vi.useFakeTimers();
    const { store, remote } = await open();
    const stop = store.startAutosave(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.saves).toBe(0);
    await store.deleteTransaction(2, 2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(remote.saves).toBe(1);
    stop();
    await store.deleteTransaction(2, 2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(remote.saves).toBe(1);
  });

  it('restores unsaved edits from the cache on the next visit', async () => {
    const cache = new MemoryCache();
    const first = await open(fixtureData(), cache);
    await first.store.addTransactions(2, [input('2026-05-01', 1, 'offline')]);
    await first.store.flushCache();
    const second = await LedgerStore.open({
      spreadsheetId: 'sheet',
      remote: first.remote,
      cache,
    });
    expect(second.getSnapshot().transactionsByAccount[2]!.some((t) => t.note === 'offline')).toBe(
      true
    );
    expect(second.getStatus().state).toBe('unsaved');
  });

  it('marks an out-of-order sheet as unsaved so the next save sorts it', async () => {
    const data = fixtureData();
    data.rows[2] = [input('2026-05-01', 1, 'may'), input('2026-04-01', 1, 'april')];
    const { store } = await open(data);
    expect(store.getSnapshot().transactionsByAccount[2]!.map((t) => t.note)).toEqual([
      'april',
      'may',
    ]);
    expect(store.getStatus().state).toBe('unsaved');
  });

  it('creates accounts with fresh ids and rejects names already used by any tab', async () => {
    const { store } = await open();
    const account = await store.createAccount('  Credit card ');
    expect(account.name).toBe('Credit card');
    expect([1, 2]).not.toContain(account.id);
    await expect(store.createAccount('savings')).rejects.toThrow('already a tab');
    await expect(store.createAccount('Budget 2025')).rejects.toThrow('already a tab');
    await expect(store.createAccount('_Secret')).rejects.toThrow('cannot start');
    await expect(store.renameAccount(1, 'Current account')).resolves.toBeUndefined();
  });

  it('stores the dashboard config', async () => {
    const { store, remote } = await open();
    expect(await store.getDashboardConfig()).toBeNull();
    await store.saveDashboardConfig({ widgets: [{ kind: 'netWorth', accounts: [1] }] });
    expect(store.getSnapshot().dashboard).toEqual({
      widgets: [{ kind: 'netWorth', accounts: [1] }],
    });
    await store.save();
    expect(remote.data.dashboard).toEqual({ widgets: [{ kind: 'netWorth', accounts: [1] }] });
  });

  it('stores the paychecks', async () => {
    const { store, remote } = await open();
    await store.savePaychecks(null);
    expect(await store.getPaychecks()).toBeNull();
    await store.savePaychecks({ paychecks: [{ id: 'p1' }] });
    expect(store.getSnapshot().paychecks).toEqual({ paychecks: [{ id: 'p1' }] });
    expect(store.hasUnsavedChanges).toBe(true);
    await store.save();
    expect(remote.data.paychecks).toEqual({ paychecks: [{ id: 'p1' }] });
  });
});
