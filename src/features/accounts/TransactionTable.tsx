import { defaultRangeExtractor, useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addCategory } from '../../lib/categories/categories';
import type { Account, Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatMonth, todayIso } from '../../lib/transactions/dates';
import {
  flattenGroups,
  groupByMonth,
  selectionAfterDelete,
  type ListItem,
} from '../../lib/transactions/display';
import { transactionKey } from '../../lib/transactions/duplicates';
import {
  draftFromTransaction,
  emptyDraft,
  isDraftDirty,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type TransactionDraft,
} from '../../lib/transactions/draft';
import {
  categoriesInUse,
  countFilters,
  defaultSort,
  filterTransactions,
  hasFilters,
  isDefaultSort,
  nextSort,
  noFilters,
  sortTransactions,
  totalsOf,
  type Sort,
  type SortKey,
  type TransactionFilters,
} from '../../lib/transactions/filters';
import {
  clickSelection,
  moveSelection,
  noSelection,
  pruneSelection,
  selectAll,
  selectOnly,
  type ClickModifiers,
  type Selection,
} from '../../lib/transactions/selection';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';
import { Kbd } from '../../ui/Kbd';
import type { MenuItem } from '../../ui/Menu';
import { TextInput } from '../../ui/TextInput';
import { DeleteConfirm } from './DeleteConfirm';
import { TransactionEditor } from './TransactionEditor';
import { TransactionFilterPanel } from './TransactionFilterPanel';
import { TransactionRow } from './TransactionRow';
import { MONTH_HEIGHT, ROW_HEIGHT, TRANSACTION_GRID } from './rowStyles';
import { useAccountActions } from './useAccountsData';

interface TransactionTableProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  /** Turns the table's shortcuts off, e.g. while a dialog is open over it. */
  paused?: boolean;
  /** Filters to open with, e.g. from a graph's "view transactions" link. The panel opens too. */
  initialFilters?: TransactionFilters;
}

type Mode = { kind: 'browse' } | { kind: 'edit'; id: string } | { kind: 'new' };

interface Editing {
  draft: TransactionDraft;
  original: TransactionDraft;
  errors: DraftErrors;
  focusField: DraftField;
  focusKey: number;
}

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'note', label: 'Note' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
];

/**
 * The account's transactions, newest first and grouped by month until a column is sorted.
 * A click selects a row; clicking the row that is the only one selected (or double-clicking) edits
 * it. Ctrl/⌘+click and Shift+click extend the selection, J/K move it, Shift+A selects everything
 * shown and Delete removes the selection. The search box and filter panel narrow the list; the menu
 * at the end of each row has the common "show me…" actions.
 *
 * Only the rows near the viewport are in the DOM (see `useWindowVirtualizer`), so a sheet with tens of
 * thousands of rows costs the same to show as one with fifty. Render with `key={account.id}` so
 * switching accounts starts fresh.
 */
export function TransactionTable({
  account,
  transactions,
  categories,
  paused = false,
  initialFilters,
}: TransactionTableProps) {
  const actions = useAccountActions();
  const [mode, setMode] = useState<Mode>({ kind: 'browse' });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [chosen, setSelection] = useState<Selection>(noSelection);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters ?? noFilters);
  const [sort, setSort] = useState<Sort>(defaultSort);
  const [panelOpen, setPanelOpen] = useState(() => initialFilters !== undefined && hasFilters(initialFilters));
  const searchRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(
    () => sortTransactions(filterTransactions(transactions, filters), sort),
    [transactions, filters, sort]
  );
  const grouped = isDefaultSort(sort);
  const groups = useMemo(() => (grouped ? groupByMonth(shown) : []), [grouped, shown]);
  const shownIds = useMemo(() => shown.map((t) => t.id), [shown]);
  const categoryNames = useMemo(() => categoriesInUse(transactions), [transactions]);
  const filtered = hasFilters(filters);
  const filteredTotals = useMemo(() => totalsOf(shown), [shown]);

  // Rows that were deleted or filtered out leave the selection.
  const selection = useMemo(() => pruneSelection(chosen, shownIds), [chosen, shownIds]);
  const selectedSet = useMemo(() => new Set(selection.ids), [selection.ids]);
  const selectedRows = useMemo(
    () => shown.filter((t) => selectedSet.has(t.id)),
    [shown, selectedSet]
  );
  const editingRow = mode.kind === 'edit' ? mode.id : null;
  const isEditing = mode.kind !== 'browse';
  const busy = isEditing || saving || paused;
  const browsing = !isEditing && !paused;

  const mobile = useMediaQuery('(max-width: 767px)');
  const items = useMemo<ListItem[]>(
    () =>
      grouped ? flattenGroups(groups) : shown.map((transaction) => ({ kind: 'row', transaction })),
    [grouped, groups, shown]
  );
  const editingIndex = useMemo(
    () =>
      editingRow === null
        ? -1
        : items.findIndex((item) => item.kind === 'row' && item.transaction.id === editingRow),
    [items, editingRow]
  );
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) => {
      const item = items[index];
      if (item?.kind === 'month') return MONTH_HEIGHT;
      if (item?.transaction.id === editingRow) return EDITOR_ESTIMATE;
      return mobile ? ROW_HEIGHT.mobile : ROW_HEIGHT.desktop;
    },
    getItemKey: (index) => {
      const item = items[index];
      return item ? (item.kind === 'month' ? `month-${item.key}` : item.transaction.id) : index;
    },
    overscan: 8,
    scrollMargin,
    // The row being edited stays rendered even when scrolled out of the window, so it keeps focus.
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      return editingIndex === -1 || indexes.includes(editingIndex)
        ? indexes
        : [...indexes, editingIndex].sort((a, b) => a - b);
    },
  });
  // Row sizes depend on the viewport and on which row is open, so they are measured again then.
  useEffect(() => virtualizer.measure(), [virtualizer, mobile, editingRow]);
  const reveal = (index: number) => virtualizer.scrollToIndex(index, { align: 'auto' });

  // Keyboard moves and new rows scroll the selection into view. Selecting from the mouse or
  // selecting everything must not move the page, so those leave `revealKey` alone.
  const [revealKey, setRevealKey] = useState(0);
  const cursor = selection.ids.at(-1);
  const latest = useRef({ items, cursor, reveal });
  useEffect(() => {
    latest.current = { items, cursor, reveal };
  });
  useEffect(() => {
    if (revealKey === 0) return;
    const { items: current, cursor: id, reveal: scroll } = latest.current;
    if (!id) return;
    const index = current.findIndex((item) => item.kind === 'row' && item.transaction.id === id);
    if (index !== -1) scroll(index);
  }, [revealKey]);
  const selectAndReveal = (next: Selection) => {
    setSelection(next);
    setRevealKey((k) => k + 1);
  };

  const beginEditing = (draft: TransactionDraft, focusField: DraftField) =>
    setEditing({ draft, original: draft, errors: {}, focusField, focusKey: 0 });

  const stopEditing = () => {
    setEditing(null);
    setMode({ kind: 'browse' });
    setWriteError(null);
  };

  const cancel = () => {
    if (isEditing) stopEditing();
    else if (confirmingDelete) setConfirmingDelete(false);
    else setSelection(noSelection);
  };

  /** Validates and writes the open editor. Resolves to whether the row was saved. */
  const save = async (): Promise<boolean> => {
    if (!editing || saving) return false;
    const result = validateDraft(editing.draft);
    if (!result.ok) {
      const first = (['date', 'category', 'note', 'amount'] as const).find((f) => result.errors[f]);
      setEditing({
        ...editing,
        errors: result.errors,
        focusField: first ?? editing.focusField,
        focusKey: editing.focusKey + 1,
      });
      return false;
    }
    setSaving(true);
    setWriteError(null);
    try {
      if (mode.kind === 'new') {
        const added = await actions.addTransaction(account.id, result.input);
        selectAndReveal(selectOnly(added?.id ?? null));
      } else if (mode.kind === 'edit') {
        const row = transactions.find((t) => t.id === mode.id)?.row;
        if (row === undefined) throw new Error('This transaction no longer exists.');
        await actions.updateTransaction(account.id, row, result.input);
      }
      stopEditing();
      return true;
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Clicking away from the editor keeps what was typed when it is valid, else leaves it open. */
  const commit = async () => {
    if (!editing || saving) return;
    if (!isDraftDirty(editing.draft, editing.original)) stopEditing();
    else await save();
  };
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    if (!editing || paused) return;
    const away = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      // Rows and menus handle themselves; the editor is inside its own row.
      if (target.closest('[data-row-id], [role="menu"], dialog')) return;
      void commitRef.current();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [editing === null, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNow = (transaction: Transaction, field: DraftField) => {
    setConfirmingDelete(false);
    setSelection(selectOnly(transaction.id));
    setMode({ kind: 'edit', id: transaction.id });
    beginEditing(draftFromTransaction(transaction), field);
  };

  const open = async (transaction: Transaction, field: DraftField) => {
    if (saving || editingRow === transaction.id) return;
    if (editing && isDraftDirty(editing.draft, editing.original)) {
      // Save the row being left. Only an edit that kept its date leaves the other rows where
      // they were, so only then can we carry on into the row that was clicked.
      const samePlace = mode.kind === 'edit' && editing.draft.date === editing.original.date;
      if (!(await save()) || !samePlace) return;
    }
    openNow(transaction, field);
  };

  const startNew = () => {
    setConfirmingDelete(false);
    setMode({ kind: 'new' });
    beginEditing(emptyDraft(todayIso()), 'category');
  };

  const editSelected = () => {
    const [only, ...rest] = selectedRows;
    if (only && rest.length === 0) openNow(only, 'note');
  };

  const select = (transaction: Transaction, modifiers: ClickModifiers) => {
    if (saving) return;
    const apply = () => setSelection((s) => clickSelection(s, shownIds, transaction.id, modifiers));
    if (!isEditing) return apply();
    // Selecting while a row is open closes it first (keeping valid changes).
    void commit().then(apply);
  };

  const activate = (transaction: Transaction, field: DraftField, modifiers: ClickModifiers) => {
    if (modifiers.toggle || modifiers.range) return select(transaction, modifiers);
    if (selectedSet.has(transaction.id) && selection.ids.length === 1)
      return void open(transaction, field);
    select(transaction, {});
  };

  const sortBy = (key: SortKey) => setSort((current) => nextSort(current, key));

  const remove = async () => {
    if (!confirmingDelete || selectedRows.length === 0 || saving) return;
    setSaving(true);
    setWriteError(null);
    try {
      const only = selectedRows.length === 1 ? selectedRows[0] : undefined;
      const next = only ? selectionAfterDelete(transactions, only) : null;
      await actions.deleteTransactions(
        account.id,
        selectedRows.map((t) => t.row)
      );
      setConfirmingDelete(false);
      // After deleting one row, keep going from the row that took its place.
      setSelection(selectOnly(next));
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const askToDelete = () => {
    if (selectedRows.length === 0) return;
    if (confirmingDelete) void remove();
    else setConfirmingDelete(true);
  };

  const duplicateRow = async (transaction: Transaction) => {
    setWriteError(null);
    try {
      const { date, category, amount, note } = transaction;
      const added = await actions.addTransaction(account.id, { date, category, amount, note });
      selectAndReveal(selectOnly(added?.id ?? null));
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    }
  };

  const showOnly = (patch: Partial<TransactionFilters>) => {
    setFilters({ ...noFilters, ...patch });
    setPanelOpen(true);
  };

  const menuFor = (t: Transaction): MenuItem[] => [
    {
      label: 'Find duplicates of this',
      onSelect: () => showOnly({ twinsOf: transactionKey(t) }),
    },
    {
      label: 'Find all duplicate transactions',
      onSelect: () => showOnly({ duplicatesOnly: true }),
    },
    {
      label: t.category ? `Show only ${t.category}` : 'Show only uncategorised',
      onSelect: () => showOnly({ categories: [t.category] }),
      separated: true,
    },
    {
      label: `Show only ${formatAmount(Math.abs(t.amount))} ${t.amount < 0 ? 'out' : 'in'}`,
      onSelect: () => showOnly({ exact: Math.abs(t.amount), sign: t.amount < 0 ? 'out' : 'in' }),
    },
    {
      label: 'Show only this note',
      disabled: !t.note,
      onSelect: () => showOnly({ search: t.note }),
    },
    {
      label: 'Show only this month',
      onSelect: () =>
        showOnly({ from: `${t.date.slice(0, 7)}-01`, to: `${t.date.slice(0, 7)}-31` }),
    },
    {
      label: 'Duplicate this transaction',
      disabled: busy,
      onSelect: () => void duplicateRow(t),
      separated: true,
    },
    {
      label: 'Delete',
      danger: true,
      disabled: busy,
      onSelect: () => {
        setSelection(selectOnly(t.id));
        setConfirmingDelete(true);
      },
    },
  ];

  const createCategory = async (name: string) => {
    await actions.saveCategories(addCategory(categories, name));
  };

  const move = (delta: number) => selectAndReveal(moveSelection(selection, shownIds, delta));
  useShortcut('transactions.down', () => move(1), browsing);
  useShortcut('transactions.up', () => move(-1), browsing);
  useShortcut(
    'transactions.selectAll',
    () => setSelection(selectAll(shownIds)),
    browsing && shown.length > 0
  );
  useShortcut('transactions.edit', editSelected, browsing && selectedRows.length === 1);
  useShortcut(
    'transactions.cancel',
    cancel,
    browsing && (selection.ids.length > 0 || confirmingDelete)
  );
  useShortcut('transactions.deleteKey', askToDelete, browsing && selectedRows.length > 0);
  useShortcut('transactions.deleteBackspace', askToDelete, browsing && selectedRows.length > 0);
  useShortcut('transactions.search', () => searchRef.current?.focus(), !paused);

  const editor = editing && (
    <TransactionEditor
      draft={editing.draft}
      errors={editing.errors}
      categories={categories}
      isNew={mode.kind === 'new'}
      saving={saving}
      total={editingRow ? transactions.find((t) => t.id === editingRow)?.total : undefined}
      focusField={editing.focusField}
      focusKey={editing.focusKey}
      onChange={(draft) => setEditing({ ...editing, draft })}
      onSave={() => void save()}
      onCancel={cancel}
      onCreateCategory={createCategory}
    />
  );

  const renderItem = ({ index, start, size }: { index: number; start: number; size: number }) => {
    const item = items[index];
    if (!item) return null;
    const style = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      transform: `translateY(${start - scrollMargin}px)`,
    } as const;
    if (item.kind === 'month')
      return (
        <div
          key={`month-${item.key}`}
          role="presentation"
          className="flex items-end justify-between bg-canvas px-3 pb-2 text-[0.8125rem]"
          style={{ ...style, height: MONTH_HEIGHT }}
        >
          <span className="font-semibold">{formatMonth(item.key)}</span>
          <span className="flex gap-3 text-xs text-muted tabular-nums">
            {item.moneyIn > 0 && (
              <span className="text-positive">{formatAmount(item.moneyIn, { signed: true })}</span>
            )}
            {item.moneyOut < 0 && <span>{formatAmount(item.moneyOut)}</span>}
          </span>
        </div>
      );
    const { transaction } = item;
    if (editingRow === transaction.id)
      return (
        <div
          key={transaction.id}
          ref={virtualizer.measureElement}
          data-index={index}
          data-row-id={transaction.id}
          style={style}
        >
          {editor}
        </div>
      );
    return (
      <div key={transaction.id} style={{ ...style, height: size }}>
        <TransactionRow
          transaction={transaction}
          categories={categories}
          selected={selectedSet.has(transaction.id)}
          onActivate={activate}
          menuItems={menuFor(transaction)}
        />
      </div>
    );
  };

  const filterCount = countFilters(filters);

  return (
    <section className="flex min-w-0 flex-col" aria-label={`${account.name} transactions`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ActionButton
          shortcut="transactions.new"
          variant="primary"
          disabled={busy}
          onAction={startNew}
        >
          New transaction
        </ActionButton>
        <ActionButton
          shortcut="transactions.delete"
          variant="danger"
          className={cn(selectedRows.length === 0 && 'max-md:hidden')}
          disabled={selectedRows.length === 0 || !browsing || saving}
          onAction={askToDelete}
        >
          {selectedRows.length > 1 ? `Delete ${selectedRows.length}` : 'Delete'}
        </ActionButton>
        <span className="inline-flex items-center gap-2 text-sm text-muted">
          {selection.ids.length > 0 && <>{selection.ids.length.toLocaleString()} selected</>}
          {selection.ids.length < shown.length && (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1.5 underline hover:text-fg disabled:cursor-default disabled:no-underline disabled:opacity-50 max-md:hidden"
              disabled={!browsing}
              onClick={() => setSelection(selectAll(shownIds))}
            >
              Select all <Kbd shortcut="transactions.selectAll" className="max-md:hidden" />
            </button>
          )}
          {selection.ids.length > 0 && (
            <button
              type="button"
              className="cursor-pointer underline hover:text-fg"
              onClick={() => setSelection(noSelection)}
            >
              Clear
            </button>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2 max-md:order-first max-md:w-full">
          <div className="relative flex items-center max-md:min-w-0 max-md:flex-1">
            <TextInput
              ref={searchRef}
              type="search"
              className="w-48 pr-9 max-md:w-full"
              aria-label="Search transactions"
              placeholder="Search notes…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.nativeEvent.stopPropagation();
                if (filters.search) setFilters({ ...filters, search: '' });
                else e.currentTarget.blur();
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center max-md:hidden">
              <Kbd shortcut="transactions.search" />
            </span>
          </div>
          <ActionButton
            variant={panelOpen ? 'primary' : 'secondary'}
            aria-expanded={panelOpen}
            onAction={() => setPanelOpen((o) => !o)}
          >
            Filters{filterCount > 0 ? ` (${filterCount})` : ''}
          </ActionButton>
        </div>
      </div>

      {panelOpen && (
        <TransactionFilterPanel
          filters={filters}
          onChange={setFilters}
          categoryNames={categoryNames}
          categories={categories}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      {filtered && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>
            Showing {shown.length} of {transactions.length}
          </span>
          {filteredTotals.moneyIn > 0 && (
            <span className="text-positive tabular-nums">
              {formatAmount(filteredTotals.moneyIn, { signed: true })}
            </span>
          )}
          {filteredTotals.moneyOut < 0 && (
            <span className="tabular-nums">{formatAmount(filteredTotals.moneyOut)}</span>
          )}
          <button
            type="button"
            className="cursor-pointer underline hover:text-fg"
            onClick={() => setFilters(noFilters)}
          >
            Clear filters
          </button>
        </p>
      )}

      {confirmingDelete && selectedRows.length > 0 && (
        <DeleteConfirm
          message={
            selectedRows.length === 1
              ? 'Delete this transaction? The row is removed from the sheet.'
              : `Delete ${selectedRows.length} transactions? The rows are removed from the sheet.`
          }
          deleteShortcut="transactions.delete"
          cancelShortcut="transactions.cancel"
          busy={saving}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {writeError && (
        <p className="mb-3 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative" role="alert">
          Could not save: {writeError}
        </p>
      )}

      <div
        className={cn(
          TRANSACTION_GRID,
          'border-b border-line px-3 pb-2 text-xs font-semibold tracking-wide text-muted uppercase max-md:hidden'
        )}
        role="row"
      >
        {COLUMNS.map((column) => {
          const active = sort.key === column.key;
          return (
            <span
              key={column.key}
              role="columnheader"
              aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              className={cn(column.align === 'right' && 'text-right')}
            >
              <button
                type="button"
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1 uppercase hover:text-fg',
                  active && 'text-fg'
                )}
                onClick={() => sortBy(column.key)}
              >
                {column.label}
                <span aria-hidden="true" className={cn('text-[0.625rem]', !active && 'opacity-0')}>
                  {sort.direction === 'asc' && active ? '▲' : '▼'}
                </span>
              </button>
            </span>
          );
        })}
        <span role="columnheader" aria-hidden="true" />
      </div>

      <div className="flex flex-col pt-2" role="rowgroup">
        {mode.kind === 'new' && editor}
        {transactions.length === 0 && mode.kind !== 'new' && (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center text-muted">
            <p>No transactions in {account.name} yet.</p>
            <p className="inline-flex items-center gap-1.5">
              Press <Kbd shortcut="transactions.new" /> to add the first one.
            </p>
          </div>
        )}
        {transactions.length > 0 && shown.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted">
            <p>No transactions match these filters.</p>
            <ActionButton variant="secondary" onAction={() => setFilters(noFilters)}>
              Clear filters
            </ActionButton>
          </div>
        )}
        <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map(renderItem)}
        </div>
      </div>
    </section>
  );
}

/** Until the editor has been measured: roughly its height with the footer, in pixels. */
const EDITOR_ESTIMATE = 128;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
