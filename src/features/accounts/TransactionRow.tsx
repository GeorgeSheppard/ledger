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
  /** Clicking a cell opens the row for editing, focusing the field that was clicked. */
  onOpen(transaction: Transaction, field: DraftField): void;
  /** Ctrl/⌘+click, Shift+click and the checkbox change the selection instead of editing. */
  onSelect(transaction: Transaction, modifiers: ClickModifiers): void;
  menuItems: readonly MenuItem[];
}

export function TransactionRow({
  transaction,
  categories,
  selected,
  onOpen,
  onSelect,
  menuItems,
}: TransactionRowProps) {
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const range = event.shiftKey;
    const toggle = event.ctrlKey || event.metaKey;
    if (target.closest('[data-select]')) {
      // The checkbox toggles one row; with Shift it extends the range like everywhere else.
      onSelect(transaction, { toggle: !range || toggle, range });
    } else if (range || toggle) {
      onSelect(transaction, { toggle, range });
    } else {
      const cell = target.closest<HTMLElement>('[data-field]');
      onOpen(transaction, (cell?.dataset.field as DraftField | undefined) ?? 'note');
    }
  };

  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-id={transaction.id}
      className={selectableRow(
        selected,
        cn(TRANSACTION_GRID, 'max-md:grid-cols-[20px_1fr_auto_32px] max-md:py-2')
      )}
      onClick={onClick}
      // Shift+click would otherwise also select the text between the two rows.
      onMouseDown={(event) => event.shiftKey && event.preventDefault()}
    >
      <div
        role="cell"
        data-select
        className="flex h-full items-center max-md:col-start-1 max-md:row-span-2 max-md:row-start-1"
      >
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-accent"
          aria-label={`Select ${transaction.note || 'transaction'}`}
          checked={selected}
          onChange={() => undefined}
        />
      </div>
      <div
        role="cell"
        className="whitespace-nowrap text-muted tabular-nums max-md:hidden"
        data-field="date"
      >
        {formatDay(transaction.date)}
      </div>
      <div
        role="cell"
        className="min-w-0 max-md:col-start-2 max-md:row-start-2"
        data-field="category"
      >
        <CategoryChip name={transaction.category} categories={categories} />
      </div>
      <div role="cell" className="truncate max-md:col-start-2 max-md:row-start-1" data-field="note">
        {transaction.note || <span className="text-muted/60">No note</span>}
      </div>
      <div
        role="cell"
        className={cn(
          'text-right whitespace-nowrap tabular-nums max-md:col-start-3 max-md:row-start-1',
          transaction.amount > 0 && 'text-positive'
        )}
        data-field="amount"
      >
        {formatAmount(transaction.amount, { signed: true })}
      </div>
      <div
        role="cell"
        className="text-right whitespace-nowrap text-muted tabular-nums max-md:col-start-3 max-md:row-start-2 max-md:text-xs"
      >
        {formatAmount(transaction.total)}
      </div>
      <div
        role="cell"
        className="flex justify-end max-md:col-start-4 max-md:row-span-2 max-md:row-start-1"
      >
        <Menu label={`Actions for ${transaction.note || 'transaction'}`} items={menuItems} />
      </div>
    </div>
  );
}
