import type { CSSProperties, MouseEvent } from 'react';
import type { Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatDay } from '../../lib/transactions/dates';
import type { DraftField } from '../../lib/transactions/draft';
import type { ClickModifiers } from '../../lib/transactions/selection';
import { categoryColor } from '../../lib/categories/categories';
import { cn } from '../../ui/cn';
import { Menu, type MenuItem } from '../../ui/Menu';
import { CategoryChip } from '../categories/CategoryChip';
import { selectableRow, TRANSACTION_GRID } from './rowStyles';

interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  selected: boolean;
  /**
   * A click on the row. `field` is the cell that was clicked. The table decides what it means: a
   * plain click selects, a click on the row that is already the only selection (so a double-click)
   * edits it, and Ctrl/⌘ and Shift extend the selection.
   */
  onActivate(transaction: Transaction, field: DraftField, modifiers: ClickModifiers): void;
  menuItems: readonly MenuItem[];
}

export function TransactionRow({
  transaction,
  categories,
  selected,
  onActivate,
  menuItems,
}: TransactionRowProps) {
  const fieldOf = (event: MouseEvent<HTMLDivElement>) =>
    ((event.target as HTMLElement).closest<HTMLElement>('[data-field]')?.dataset.field ??
      'note') as DraftField;

  const onClick = (event: MouseEvent<HTMLDivElement>) =>
    onActivate(transaction, fieldOf(event), {
      range: event.shiftKey,
      toggle: event.ctrlKey || event.metaKey,
    });

  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-id={transaction.id}
      className={selectableRow(
        selected,
        cn(
          TRANSACTION_GRID,
          'h-full select-none max-md:grid-cols-[3rem_0.5rem_minmax(0,1fr)_auto_28px] max-md:gap-x-2 max-md:px-2'
        )
      )}
      onClick={onClick}
      // Shift+click would otherwise also select the text between the two rows.
      onMouseDown={(event) => event.shiftKey && event.preventDefault()}
    >
      <div
        role="cell"
        className="text-xs whitespace-nowrap text-muted tabular-nums md:text-sm"
        data-field="date"
      >
        {formatDay(transaction.date)}
      </div>
      <div
        role="cell"
        className="min-w-0"
        data-field="category"
        title={transaction.category || 'Uncategorised'}
      >
        <CategoryChip
          name={transaction.category}
          categories={categories}
          className="max-md:hidden"
        />
        <span
          className="block size-2 rounded-full bg-(--chip) md:hidden"
          style={{ '--chip': categoryColor(categories, transaction.category) } as CSSProperties}
          aria-hidden="true"
        />
      </div>
      <div role="cell" className="truncate" data-field="note">
        {transaction.note || <span className="text-muted/60">No note</span>}
      </div>
      <div
        role="cell"
        className={cn(
          'text-right whitespace-nowrap tabular-nums',
          transaction.amount > 0 && 'text-positive'
        )}
        data-field="amount"
      >
        {formatAmount(transaction.amount, { signed: true })}
      </div>
      <div
        role="cell"
        className="text-right whitespace-nowrap text-muted tabular-nums max-md:hidden"
      >
        {formatAmount(transaction.total)}
      </div>
      <div role="cell" className="flex justify-end">
        <Menu label={`Actions for ${transaction.note || 'transaction'}`} items={menuItems} />
      </div>
    </div>
  );
}
