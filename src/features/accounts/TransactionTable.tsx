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
import './TransactionTable.css';

interface TransactionTableProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
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
export function TransactionTable({ account, transactions, categories }: TransactionTableProps) {
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
  const busy = isEditing(state) || saving;

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

  const browsing = mode.kind === 'browse';
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
    <section className="transaction-table" aria-label={`${account.name} transactions`}>
      <div className="transaction-table__toolbar">
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
        <span className="transaction-table__hint">
          <Kbd shortcut="transactions.down" />
          <Kbd shortcut="transactions.up" />
          to move
        </span>
      </div>

      {writeError && (
        <p className="transaction-table__error" role="alert">
          Could not save: {writeError}
        </p>
      )}

      <div className="transaction-table__head" role="row">
        <span role="columnheader">Date</span>
        <span role="columnheader">Category</span>
        <span role="columnheader">Note</span>
        <span role="columnheader" className="transaction-table__numeric">
          Amount
        </span>
        <span role="columnheader" className="transaction-table__numeric">
          Total
        </span>
      </div>

      <div className="transaction-table__body" role="rowgroup" ref={listRef}>
        {mode.kind === 'new' && editor}
        {ordered.length === 0 && mode.kind !== 'new' && (
          <div className="transaction-table__empty">
            <p>No transactions in {account.name} yet.</p>
            <p>
              Press <Kbd shortcut="transactions.new" /> to add the first one.
            </p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.key} className="transaction-table__group" role="presentation">
            <div className="transaction-table__month" role="presentation">
              <span className="transaction-table__month-name">{formatMonth(group.key)}</span>
              <span className="transaction-table__month-totals">
                {group.moneyIn > 0 && (
                  <span className="transaction-table__in">
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
                  <div key={transaction.id} className="transaction-table__confirming">
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
