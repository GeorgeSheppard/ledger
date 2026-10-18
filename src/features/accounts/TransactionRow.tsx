import type { MouseEvent } from 'react';
import type { Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatDay } from '../../lib/transactions/dates';
import type { DraftField } from '../../lib/transactions/draft';
import type { ClickModifiers } from '../../lib/transactions/selection';
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
        cn(TRANSACTION_GRID, 'h-full select-none max-md:grid-cols-[1fr_auto_32px]')
      )}
      onClick={onClick}
      // Shift+click would otherwise also select the text between the two rows.
      onMouseDown={(event) => event.shiftKey && event.preventDefault()}
    >
      <div
        role="cell"
        className="whitespace-nowrap text-muted tabular-nums max-md:hidden"
        data-field="date"
      >
        {formatDay(transaction.date)}
      </div>
      <div
        role="cell"
        className="min-w-0 max-md:col-start-1 max-md:row-start-2"
        data-field="category"
      >
        <CategoryChip name={transaction.category} categories={categories} />
      </div>
      <div role="cell" className="truncate max-md:col-start-1 max-md:row-start-1" data-field="note">
        {transaction.note || <span className="text-muted/60">No note</span>}
      </div>
      <div
        role="cell"
        className={cn(
          'text-right whitespace-nowrap tabular-nums max-md:col-start-2 max-md:row-start-1',
          transaction.amount > 0 && 'text-positive'
        )}
        data-field="amount"
      >
        {formatAmount(transaction.amount, { signed: true })}
      </div>
      <div
        role="cell"
        className="text-right whitespace-nowrap text-muted tabular-nums max-md:col-start-2 max-md:row-start-2 max-md:text-xs"
      >
        {formatAmount(transaction.total)}
      </div>
      <div
        role="cell"
        className="flex justify-end max-md:col-start-3 max-md:row-span-2 max-md:row-start-1"
      >
        <Menu label={`Actions for ${transaction.note || 'transaction'}`} items={menuItems} />
      </div>
    </div>
  );
}
