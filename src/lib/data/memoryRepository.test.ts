import { describe, expect, it } from 'vitest';
import { fixtureData } from './fixtures';
import { MemoryRepository } from './memoryRepository';

describe('MemoryRepository', () => {
  it('numbers rows from 2 and computes running totals', async () => {
    const repo = new MemoryRepository({
      accounts: [{ id: 1, name: 'A' }],
      rows: {
        1: [
          { date: '2026-01-01', category: '', amount: 100, note: '' },
          { date: '2026-01-02', category: 'Food', amount: -30.1, note: '' },
        ],
      },
      categories: [],
    });
    const txs = await repo.listTransactions(1);
    expect(txs.map((t) => [t.id, t.row, t.total])).toEqual([
      ['1:2', 2, 100],
      ['1:3', 3, 69.9],
    ]);
  });

  it('adds, updates and deletes rows', async () => {
    const repo = new MemoryRepository(fixtureData());
    const account = await repo.createAccount('Cash');
    const [added] = await repo.addTransactions(account.id, [
      { date: '2026-02-01', category: 'Groceries', amount: -5, note: 'Milk' },
    ]);
    expect(added?.row).toBe(2);
    await repo.updateTransaction(account.id, 2, { ...added!, amount: -6 });
    expect((await repo.listTransactions(account.id))[0]?.total).toBe(-6);
    await repo.deleteTransaction(account.id, 2);
    expect(await repo.listTransactions(account.id)).toEqual([]);
  });

  it('renames a category everywhere', async () => {
    const repo = new MemoryRepository(fixtureData());
    await repo.renameCategory('Groceries', 'Food');
    const categories = await repo.listCategories();
    expect(categories.some((c) => c.name === 'Food')).toBe(true);
    const txs = await repo.listTransactions(1);
    expect(txs.some((t) => t.category === 'Groceries')).toBe(false);
    expect(txs.some((t) => t.category === 'Food')).toBe(true);
  });

  it('does not leak internal state', async () => {
    const repo = new MemoryRepository(fixtureData());
    const [first] = await repo.listAccounts();
    first!.name = 'Changed';
    expect((await repo.listAccounts())[0]?.name).toBe('Current account');
  });
});
