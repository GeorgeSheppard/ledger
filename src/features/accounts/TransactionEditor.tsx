import { useEffect, useRef, type ReactNode } from 'react';
import type { Category } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import type { DraftErrors, DraftField, TransactionDraft } from '../../lib/transactions/draft';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';
import { TextInput } from '../../ui/TextInput';
import { CategoryPicker } from '../categories/CategoryPicker';
import { EDITOR_FOOTER, EDITOR_PANEL, TRANSACTION_GRID } from './rowStyles';

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
      className={EDITOR_PANEL}
      data-editor={isNew ? 'new' : 'edit'}
      aria-label={isNew ? 'New transaction' : 'Edit transaction'}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={cn(TRANSACTION_GRID, 'items-center px-3 py-2 max-md:grid-cols-2')}>
        <Cell field="date">
          <TextInput
            type="date"
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
          <TextInput
            aria-label="Note"
            placeholder="What was it?"
            value={draft.note}
            onChange={(e) => set('note')(e.target.value)}
          />
        </Cell>
        <Cell field="amount">
          <TextInput
            className="text-right tabular-nums"
            aria-label="Amount"
            inputMode="decimal"
            placeholder="-0.00"
            aria-invalid={!!errors.amount || undefined}
            value={draft.amount}
            onChange={(e) => set('amount')(e.target.value)}
          />
        </Cell>
        <div
          className="text-right text-sm text-muted tabular-nums max-md:hidden"
          aria-label="Total"
        >
          {total === undefined ? '' : formatAmount(total)}
        </div>
        <span className="max-md:hidden" aria-hidden="true" />
      </div>
      <div className={EDITOR_FOOTER}>
        <p
          className={cn('text-[0.8125rem] text-muted', errorList.length && 'text-negative')}
          role={errorList.length ? 'alert' : undefined}
        >
          {errorList.length
            ? errorList.join('. ')
            : 'Negative amounts are money out, positive is money in.'}
        </p>
        <div className="flex gap-2">
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
    <div data-field={field} className={cn(field === 'note' && 'max-md:col-span-2')}>
      {children}
    </div>
  );
}
