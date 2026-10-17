import { useEffect, useRef, type ReactNode } from 'react';
import type { Category } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import type { DraftErrors, DraftField, TransactionDraft } from '../../lib/transactions/draft';
import { ActionButton } from '../../ui/ActionButton';
import { CategoryPicker } from '../categories/CategoryPicker';
import './inlineField.css';
import './TransactionEditor.css';

interface TransactionEditorProps {
  draft: TransactionDraft;
  errors: DraftErrors;
  categories: Category[];
  isNew: boolean;
  saving: boolean;
  /** Running total of the row being edited, shown for context. */
  total?: number;
  /** Which field gets focus. Changing `focusKey` re-applies it (e.g. after a failed save). */
  focusField: DraftField;
  focusKey: number;
  onChange(draft: TransactionDraft): void;
  onSave(): void;
  onCancel(): void;
  onCreateCategory(name: string): Promise<void>;
}

/** A transaction row turned into inputs. Enter or ⌘↵ saves, Escape cancels. */
export function TransactionEditor({
  draft,
  errors,
  categories,
  isNew,
  saving,
  total,
  focusField,
  focusKey,
  onChange,
  onSave,
  onCancel,
  onCreateCategory,
}: TransactionEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>(`[data-field="${focusField}"] input`)?.focus();
  }, [focusField, focusKey]);

  const set = (field: DraftField) => (value: string) => onChange({ ...draft, [field]: value });
  const errorList = Object.values(errors);

  return (
    <form
      ref={formRef}
      className={['transaction-editor', isNew && 'transaction-editor--new']
        .filter(Boolean)
        .join(' ')}
      aria-label={isNew ? 'New transaction' : 'Edit transaction'}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="transaction-editor__fields">
        <Cell field="date">
          <input
            type="date"
            className="inline-field"
            aria-label="Date"
            aria-invalid={!!errors.date || undefined}
            value={draft.date}
            onChange={(e) => set('date')(e.target.value)}
          />
        </Cell>
        <Cell field="category">
          <CategoryPicker
            value={draft.category}
            categories={categories}
            onChange={set('category')}
            onCreate={onCreateCategory}
          />
        </Cell>
        <Cell field="note">
          <input
            className="inline-field"
            aria-label="Note"
            placeholder="What was it?"
            value={draft.note}
            onChange={(e) => set('note')(e.target.value)}
          />
        </Cell>
        <Cell field="amount">
          <input
            className="inline-field inline-field--numeric"
            aria-label="Amount"
            inputMode="decimal"
            placeholder="-0.00"
            aria-invalid={!!errors.amount || undefined}
            value={draft.amount}
            onChange={(e) => set('amount')(e.target.value)}
          />
        </Cell>
        <div className="transaction-editor__total" aria-label="Total">
          {total === undefined ? '' : formatAmount(total)}
        </div>
      </div>
      <div className="transaction-editor__footer">
        <p className="transaction-editor__message" role={errorList.length ? 'alert' : undefined}>
          {errorList.length
            ? errorList.join('. ')
            : 'Negative amounts are money out, positive is money in.'}
        </p>
        <div className="transaction-editor__actions">
          <ActionButton shortcut="transactions.cancel" variant="ghost" onAction={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            shortcut="transactions.save"
            variant="primary"
            disabled={saving}
            onAction={onSave}
          >
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </ActionButton>
        </div>
      </div>
    </form>
  );
}

function Cell({ field, children }: { field: DraftField; children: ReactNode }) {
  return (
    <div className="transaction-editor__cell" data-field={field}>
      {children}
    </div>
  );
}
