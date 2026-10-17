import type { Account, Category, Transaction, TransactionInput } from '../domain/types';
import { runningTotals } from '../transactions/runningTotal';
import type { LedgerRepository } from './repository';

export interface MemoryData {
  accounts: Account[];
  /** Rows per account id, in sheet order. */
  rows: Record<number, TransactionInput[]>;
  categories: Category[];
}

/** In-memory `LedgerRepository`. Behaves like the sheet: rows are addressed by row number. */
export class MemoryRepository implements LedgerRepository {
  private data: MemoryData;
  private nextAccountId: number;

  constructor(seed: MemoryData) {
    this.data = structuredClone(seed);
    this.nextAccountId = Math.max(0, ...seed.accounts.map((a) => a.id)) + 1;
  }

  async listAccounts(): Promise<Account[]> {
    return structuredClone(this.data.accounts);
  }

  async createAccount(name: string): Promise<Account> {
    const account = { id: this.nextAccountId++, name };
    this.data.accounts.push(account);
    this.data.rows[account.id] = [];
    return { ...account };
  }

  async renameAccount(accountId: number, name: string): Promise<void> {
    this.account(accountId).name = name;
  }

  async listTransactions(accountId: number): Promise<Transaction[]> {
    const rows = this.rows(accountId);
    const totals = runningTotals(rows.map((r) => r.amount));
    return rows.map((input, i) => {
      const row = i + 2;
      return { ...input, id: `${accountId}:${row}`, accountId, row, total: totals[i] ?? 0 };
    });
  }

  async addTransactions(accountId: number, inputs: TransactionInput[]): Promise<Transaction[]> {
    const rows = this.rows(accountId);
    const start = rows.length;
    rows.push(...structuredClone(inputs));
    return (await this.listTransactions(accountId)).slice(start);
  }

  async updateTransaction(accountId: number, row: number, input: TransactionInput): Promise<void> {
    const rows = this.rows(accountId);
    this.assertRow(rows, row);
    rows[row - 2] = { ...input };
  }

  async deleteTransaction(accountId: number, row: number): Promise<void> {
    const rows = this.rows(accountId);
    this.assertRow(rows, row);
    rows.splice(row - 2, 1);
  }

  async listCategories(): Promise<Category[]> {
    return structuredClone(this.data.categories);
  }

  async saveCategories(categories: Category[]): Promise<void> {
    this.data.categories = structuredClone(categories);
  }

  async renameCategory(from: string, to: string): Promise<void> {
    for (const category of this.data.categories) if (category.name === from) category.name = to;
    for (const rows of Object.values(this.data.rows))
      for (const row of rows) if (row.category === from) row.category = to;
  }

  private account(accountId: number): Account {
    const account = this.data.accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`Unknown account ${accountId}`);
    return account;
  }

  private rows(accountId: number): TransactionInput[] {
    this.account(accountId);
    return (this.data.rows[accountId] ??= []);
  }

  private assertRow(rows: TransactionInput[], row: number) {
    if (row < 2 || row - 2 >= rows.length) throw new Error(`Unknown row ${row}`);
  }
}
