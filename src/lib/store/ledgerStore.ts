import { CommandStack } from '../commands/commandStack';
import type { LedgerRepository } from '../data/repository';
import type { Account, Category, Transaction, TransactionInput } from '../domain/types';
import { noCache, type LedgerCache } from './cache';
import * as edit from './ledgerData';
import {
  rebase,
  sameData,
  sortAllByDate,
  toSnapshot,
  withUsedCategories,
  type JsonValue,
  type LedgerData,
  type LedgerSnapshot,
} from './ledgerData';
import {
  newSheetId,
  type DownloadedFile,
  type LedgerRemote,
  type LoadProgress,
  type RemoteState,
} from './remote';

export type SyncStatus =
  /** Everything is in the sheet. `savedAt` is `null` when nothing was saved this session. */
  | { state: 'saved'; savedAt: number | null }
  /** There are edits only in this browser. */
  | { state: 'unsaved' }
  | { state: 'saving' }
  /** The last save failed; the edits are still kept locally and the next save retries them. */
  | { state: 'error'; message: string };

export const AUTOSAVE_INTERVAL_MS = 60_000;

export interface OpenOptions {
  /** Cache key; the spreadsheet id. */
  spreadsheetId: string;
  remote: LedgerRemote;
  cache?: LedgerCache;
  now?: () => number;
  /** Told how far the read of the remote has got. */
  onProgress?: (progress: LoadProgress) => void;
}

/**
 * The app's copy of the spreadsheet. It is read from the sheet once, edited locally (and kept in
 * the browser cache so nothing is lost if the page closes), and written back in one batch when
 * `save()` runs: every minute via `startAutosave()`, or when the user asks.
 *
 * It implements `LedgerRepository` so features keep one seam. Edits take effect immediately: the
 * snapshot changes and subscribers are told before the returned promise resolves.
 */
export class LedgerStore implements LedgerRepository {
  private readonly spreadsheetId: string;
  private readonly remote: LedgerRemote;
  private readonly cache: LedgerCache;
  private readonly now: () => number;
  private saved: RemoteState;
  private current: LedgerData;
  private snapshot: LedgerSnapshot;
  private status: SyncStatus;
  private saving: Promise<void> | null = null;
  private lastError: string | null = null;
  private savedAt: number | null = null;
  private cacheWrite: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  /**
   * Everything the user can undo, edits to this spreadsheet and view changes alike. Every edit
   * below records itself here; undoing one is saved like any other change.
   */
  readonly history = new CommandStack();

  /** Loads the spreadsheet (one read) and replays any unsaved edits left in the cache. */
  static async open({
    spreadsheetId,
    remote,
    cache = noCache,
    now = Date.now,
    onProgress,
  }: OpenOptions) {
    const fresh = await remote.load(onProgress);
    const cached = await cache.get(spreadsheetId).catch(() => null);
    let current = fresh.data;
    if (cached && !sameData(cached.current, cached.saved.data))
      current = rebase(fresh.data, cached.saved.data, cached.current);
    const store = new LedgerStore(
      spreadsheetId,
      remote,
      cache,
      now,
      fresh,
      withUsedCategories(sortAllByDate(current))
    );
    store.persist();
    return store;
  }

  private constructor(
    spreadsheetId: string,
    remote: LedgerRemote,
    cache: LedgerCache,
    now: () => number,
    saved: RemoteState,
    current: LedgerData
  ) {
    this.spreadsheetId = spreadsheetId;
    this.remote = remote;
    this.cache = cache;
    this.now = now;
    this.saved = saved;
    this.current = current;
    this.snapshot = toSnapshot(current, saved.skippedTabs, saved.tabReports);
    this.status = this.computeStatus();
  }

  // --- Reading and subscribing (shaped for React's useSyncExternalStore) ---

  getSnapshot = (): LedgerSnapshot => this.snapshot;

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get hasUnsavedChanges(): boolean {
    return !sameData(this.current, this.saved.data);
  }

  // --- Saving ---

  /** Writes unsaved edits to the sheet. Rejects if the write fails; the edits stay local. */
  async save(): Promise<void> {
    while (this.saving) await this.saving.catch(() => {});
    const next = this.current;
    if (sameData(next, this.saved.data)) return;
    const run = (async () => {
      try {
        this.saved = await this.remote.save(this.saved, next);
        this.lastError = null;
        this.savedAt = this.now();
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.saving = null;
        this.persist();
        this.emit();
      }
    })();
    this.saving = run;
    this.emit();
    return run;
  }

  /** True when the ledger lives in a file: changes leave through `download()`, never autosave. */
  get isFile(): boolean {
    return this.remote.download !== undefined;
  }

  /**
   * Builds the updated file from the working copy and counts the changes as saved. The caller hands
   * the file to the browser. Rejects if the remote has no file to build.
   */
  async download(): Promise<DownloadedFile> {
    const build = this.remote.download;
    if (!build) throw new Error('This spreadsheet is saved to Google, not downloaded.');
    const file = await build.call(this.remote, this.current);
    await this.save();
    return file;
  }

  /** Saves every `intervalMs` while there are unsaved edits. Returns a function that stops it. */
  startAutosave(intervalMs = AUTOSAVE_INTERVAL_MS): () => void {
    const timer = setInterval(() => {
      if (this.hasUnsavedChanges && !this.saving) this.save().catch(() => {});
    }, intervalMs);
    return () => clearInterval(timer);
  }

  /** Resolves once the browser cache holds the latest working copy. */
  flushCache(): Promise<void> {
    return this.cacheWrite;
  }

  // --- LedgerRepository ---

  async listAccounts(): Promise<Account[]> {
    return structuredClone(this.snapshot.accounts);
  }

  async createAccount(name: string): Promise<Account> {
    const title = edit.checkAccountName(this.current, name, this.takenNames());
    const id = newSheetId([
      ...this.saved.layout.sheetIds,
      ...this.current.accounts.map((a) => a.id),
    ]);
    const account = { id, name: title };
    this.apply(edit.createAccount(this.current, account), `Add account “${title}”`);
    return { ...account };
  }

  async renameAccount(accountId: number, name: string): Promise<void> {
    const title = edit.checkAccountName(this.current, name, this.takenNames(), accountId);
    this.apply(edit.renameAccount(this.current, accountId, title), `Rename account to “${title}”`);
  }

  async setAccountInverted(accountId: number, inverted: boolean): Promise<void> {
    this.apply(
      edit.setAccountInverted(this.current, accountId, inverted),
      inverted ? 'Flip amount signs' : 'Stop flipping amount signs'
    );
  }

  async listTransactions(accountId: number): Promise<Transaction[]> {
    return structuredClone(this.snapshot.transactionsByAccount[accountId] ?? []);
  }

  async addTransactions(accountId: number, inputs: TransactionInput[]): Promise<Transaction[]> {
    if (inputs.length === 0) return [];
    const { data, rows } = edit.addTransactions(this.current, accountId, inputs);
    this.apply(data, `Add ${count(inputs.length, 'transaction')}`);
    const all = this.snapshot.transactionsByAccount[accountId] ?? [];
    return rows.map((row) => structuredClone(all[row - 2]!));
  }

  async updateTransaction(accountId: number, row: number, input: TransactionInput): Promise<void> {
    this.apply(edit.updateTransaction(this.current, accountId, row, input), 'Edit transaction');
  }

  async deleteTransaction(accountId: number, row: number): Promise<void> {
    this.apply(edit.deleteTransaction(this.current, accountId, row), 'Delete transaction');
  }

  async deleteTransactions(accountId: number, rows: number[]): Promise<void> {
    this.apply(
      edit.deleteTransactions(this.current, accountId, rows),
      `Delete ${count(rows.length, 'transaction')}`
    );
  }

  async listCategories(): Promise<Category[]> {
    return structuredClone(this.snapshot.categories);
  }

  async saveCategories(categories: Category[]): Promise<void> {
    this.apply(
      edit.saveCategories(this.current, categories),
      describeCategoryChange(this.current.categories, categories)
    );
  }

  async renameCategory(from: string, to: string): Promise<void> {
    this.apply(edit.renameCategory(this.current, from, to), `Rename category “${from}” to “${to}”`);
  }

  async migrateCategory(from: string, to: string, archive = false): Promise<void> {
    this.apply(
      edit.migrateCategory(this.current, from, to, archive),
      `${archive ? 'Archive' : 'Move'} “${from}” into “${to}”`
    );
  }

  async getPaychecks(): Promise<JsonValue | null> {
    return structuredClone(this.snapshot.paychecks);
  }

  async savePaychecks(config: JsonValue | null): Promise<void> {
    this.apply(edit.setPaychecks(this.current, config), 'Edit paychecks');
  }

  // --- Internals ---

  /** Tabs that are not accounts but still own their name in the spreadsheet. */
  private takenNames(): string[] {
    return this.saved.skippedTabs.map((t) => t.title);
  }

  /** Makes `next` the working copy and records `label` so the edit can be undone. */
  private apply(next: LedgerData, label: string) {
    const before = this.current;
    if (next === before) return;
    this.restore(next);
    this.history.record({
      label,
      undo: () => this.restore(before),
      redo: () => this.restore(next),
    });
  }

  /** Swaps the working copy without recording anything; saving then writes whatever differs. */
  private restore(next: LedgerData) {
    this.current = next;
    this.snapshot = toSnapshot(next, this.saved.skippedTabs, this.saved.tabReports);
    this.persist();
    this.emit();
  }

  private persist() {
    const value = { saved: this.saved, current: this.current };
    this.cacheWrite = this.cacheWrite
      .then(() => this.cache.put(this.spreadsheetId, value))
      .catch((error: unknown) =>
        console.warn('Could not keep unsaved edits in this browser', error)
      );
  }

  private computeStatus(): SyncStatus {
    if (this.saving) return { state: 'saving' };
    if (!this.hasUnsavedChanges) return { state: 'saved', savedAt: this.savedAt };
    if (this.lastError) return { state: 'error', message: this.lastError };
    return { state: 'unsaved' };
  }

  private emit() {
    const status = this.computeStatus();
    if (JSON.stringify(status) !== JSON.stringify(this.status)) this.status = status;
    for (const listener of this.listeners) listener();
  }
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** "Add category “Food”" and the like, for the undo notice. */
function describeCategoryChange(before: Category[], after: Category[]): string {
  const names = new Set(before.map((c) => c.name));
  const added = after.filter((c) => !names.has(c.name));
  if (after.length > before.length && added.length === 1) return `Add category “${added[0]!.name}”`;
  const kept = new Set(after.map((c) => c.name));
  const removed = before.filter((c) => !kept.has(c.name));
  if (after.length < before.length && removed.length === 1)
    return `Delete category “${removed[0]!.name}”`;
  return 'Edit categories';
}
