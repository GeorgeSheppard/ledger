import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { addCategory } from '../../lib/categories/categories';
import type { Account, Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatMonth, todayIso } from '../../lib/transactions/dates';
import { displayOrder, groupByMonth, selectionAfterDelete } from '../../lib/transactions/display';
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
  initialRowEditorState,
  isEditing,
  rowEditorReducer,
} from '../../lib/transactions/rowEditor';
import { useShortcut } from '../../state/shortcuts';
import { ActionButton } from '../../ui/ActionButton';
import { Kbd } from '../../ui/Kbd';
import { DeleteConfirm } from './DeleteConfirm';
import { TransactionEditor } from './TransactionEditor';
import { TransactionRow } from './TransactionRow';
import { useAccountActions } from './useAccountsData';
import { cn } from '../../ui/cn';
import { TRANSACTION_GRID } from './rowStyles';

interface TransactionTableProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  /** Turns the table's shortcuts off, e.g. while a dialog is open over it. */
  paused?: boolean;
}

interface Editing {
  draft: TransactionDraft;
  original: TransactionDraft;
  errors: DraftErrors;
  focusField: DraftField;
  focusKey: number;
}

/**
 * The account's transactions, newest first, grouped by month. One row can be selected (click, or
 * J/K) and opened for inline editing; N adds a new row at the top. Render with `key={account.id}`
 * so switching accounts starts fresh.
 */
export function TransactionTable({
  account,
  transactions,
  categories,
  paused = false,
}: TransactionTableProps) {
  const actions = useAccountActions();
  const [state, dispatch] = useReducer(rowEditorReducer, initialRowEditorState);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(() => displayOrder(transactions), [transactions]);
  const groups = useMemo(() => groupByMonth(ordered), [ordered]);
  const ids = useMemo(() => ordered.map((t) => t.id), [ordered]);
  const selected = ordered.find((t) => t.id === state.selectedId);
  const mode = state.mode;
  const busy = isEditing(state) || saving || paused;

  useEffect(() => {
    if (!state.selectedId) return;
    listRef.current
      ?.querySelector(`[data-row-id="${CSS.escape(state.selectedId)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [state.selectedId, mode.kind]);

  const beginEditing = (draft: TransactionDraft, focusField: DraftField) =>
    setEditing({ draft, original: draft, errors: {}, focusField, focusKey: 0 });

  const stopEditing = () => {
    setEditing(null);
    setWriteError(null);
  };

  const open = (transaction: Transaction, field: DraftField) => {
    if (saving) return;
    if (mode.kind === 'edit' && mode.id === transaction.id) return;
    if (editing && isDraftDirty(editing.draft, editing.original)) {
      // Keep unsaved work: point the user back at the open editor instead.
      setEditing({ ...editing, focusKey: editing.focusKey + 1 });
      return;
    }
    dispatch({ type: 'cancel' });
    dispatch({ type: 'edit', id: transaction.id });
    beginEditing(draftFromTransaction(transaction), field);
  };

  const startNew = () => {
    dispatch({ type: 'new' });
    beginEditing(emptyDraft(todayIso()), 'category');
  };

  const editSelected = () => {
    if (!selected) return;
    dispatch({ type: 'edit' });
    beginEditing(draftFromTransaction(selected), 'note');
  };

  const cancel = () => {
    dispatch({ type: 'cancel' });
    stopEditing();
  };

  const save = async () => {
    if (!editing || saving) return;
    const result = validateDraft(editing.draft);
    if (!result.ok) {
      const first = (['date', 'category', 'note', 'amount'] as const).find((f) => result.errors[f]);
      setEditing({
        ...editing,
        errors: result.errors,
        focusField: first ?? editing.focusField,
        focusKey: editing.focusKey + 1,
      });
      return;
    }
    setSaving(true);
    setWriteError(null);
    try {
      if (mode.kind === 'new') {
        const added = await actions.addTransaction(account.id, result.input);
        dispatch({ type: 'done', selectId: added?.id ?? null });
      } else if (mode.kind === 'edit' && selected) {
        await actions.updateTransaction(account.id, selected.row, result.input);
        dispatch({ type: 'done' });
      }
      stopEditing();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (mode.kind !== 'confirm-delete' || !selected || saving) return;
    setSaving(true);
    setWriteError(null);
    try {
      const next = selectionAfterDelete(transactions, selected);
      await actions.deleteTransaction(account.id, selected.row);
      dispatch({ type: 'done', selectId: next });
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const createCategory = async (name: string) => {
    await actions.saveCategories(addCategory(categories, name));
  };

  const browsing = mode.kind === 'browse' && !paused;
  useShortcut('transactions.down', () => dispatch({ type: 'move', delta: 1, ids }), browsing);
  useShortcut('transactions.up', () => dispatch({ type: 'move', delta: -1, ids }), browsing);
  useShortcut('transactions.cancel', cancel, browsing && !!selected);

  const editor = editing && (
    <TransactionEditor
      draft={editing.draft}
      errors={editing.errors}
      categories={categories}
      isNew={mode.kind === 'new'}
      saving={saving}
      total={mode.kind === 'edit' ? selected?.total : undefined}
      focusField={editing.focusField}
      focusKey={editing.focusKey}
      onChange={(draft) => setEditing({ ...editing, draft })}
      onSave={() => void save()}
      onCancel={cancel}
      onCreateCategory={createCategory}
    />
  );

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
          shortcut="transactions.edit"
          disabled={!selected || !browsing || saving}
          onAction={editSelected}
        >
          Edit
        </ActionButton>
        <ActionButton
          shortcut="transactions.delete"
          variant="danger"
          disabled={!selected || !browsing || saving}
          onAction={() => dispatch({ type: 'confirm-delete' })}
        >
          Delete
        </ActionButton>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[0.8125rem] text-muted max-md:hidden">
          <Kbd shortcut="transactions.down" />
          <Kbd shortcut="transactions.up" />
          to move
        </span>
      </div>

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
        <span role="columnheader">Date</span>
        <span role="columnheader">Category</span>
        <span role="columnheader">Note</span>
        <span role="columnheader" className="text-right">
          Amount
        </span>
        <span role="columnheader" className="text-right">
          Total
        </span>
      </div>

      <div className="flex flex-col pt-2" role="rowgroup" ref={listRef}>
        {mode.kind === 'new' && editor}
        {ordered.length === 0 && mode.kind !== 'new' && (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center text-muted">
            <p>No transactions in {account.name} yet.</p>
            <p className="inline-flex items-center gap-1.5">
              Press <Kbd shortcut="transactions.new" /> to add the first one.
            </p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key} className="group" role="presentation">
            <div
              className="sticky top-0 z-1 mt-4 flex items-baseline justify-between bg-canvas px-3 py-2 text-[0.8125rem] group-first:mt-0"
              role="presentation"
            >
              <span className="font-semibold">{formatMonth(group.key)}</span>
              <span className="flex gap-3 text-xs text-muted tabular-nums">
                {group.moneyIn > 0 && (
                  <span className="text-positive">
                    {formatAmount(group.moneyIn, { signed: true })}
                  </span>
                )}
                {group.moneyOut < 0 && <span>{formatAmount(group.moneyOut)}</span>}
              </span>
            </div>
            {group.transactions.map((transaction) => {
              if (mode.kind === 'edit' && mode.id === transaction.id)
                return (
                  <div key={transaction.id} data-row-id={transaction.id}>
                    {editor}
                  </div>
                );
              const row = (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  categories={categories}
                  selected={transaction.id === state.selectedId}
                  onOpen={open}
                />
              );
              if (mode.kind === 'confirm-delete' && mode.id === transaction.id)
                return (
                  <div key={transaction.id}>
                    {row}
                    <DeleteConfirm
                      message="Delete this transaction? The row is removed from the sheet."
                      deleteShortcut="transactions.delete"
                      cancelShortcut="transactions.cancel"
                      busy={saving}
                      onConfirm={() => void remove()}
                      onCancel={cancel}
                    />
                  </div>
                );
              return row;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
