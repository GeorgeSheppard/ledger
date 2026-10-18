import type { MouseEvent } from 'react';
import type { Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatDay } from '../../lib/transactions/dates';
import type { DraftField } from '../../lib/transactions/draft';
import { cn } from '../../ui/cn';
import { CategoryChip } from '../categories/CategoryChip';
import { selectableRow, TRANSACTION_GRID } from './rowStyles';

interface TransactionRowProps {
  transaction: Transaction;
  categories: Category[];
  selected: boolean;
  /** Clicking a row opens it for editing, focusing the field that was clicked. */
  onOpen(transaction: Transaction, field: DraftField): void;
}

export function TransactionRow({ transaction, categories, selected, onOpen }: TransactionRowProps) {
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-field]');
    onOpen(transaction, (cell?.dataset.field as DraftField | undefined) ?? 'note');
  };

  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-id={transaction.id}
      className={selectableRow(
        selected,
        cn(TRANSACTION_GRID, 'max-md:grid-cols-[1fr_auto] max-md:py-2')
      )}
      onClick={onClick}
    >
      <div
        role="cell"
        className="whitespace-nowrap text-muted tabular-nums max-md:hidden"
        data-field="date"
      >
        {formatDay(transaction.date)}
      </div>
      <div role="cell" className="min-w-0 max-md:order-3" data-field="category">
        <CategoryChip name={transaction.category} categories={categories} />
      </div>
      <div role="cell" className="truncate max-md:order-1" data-field="note">
        {transaction.note || <span className="text-muted/60">No note</span>}
      </div>
      <div
        role="cell"
        className={cn(
          'text-right whitespace-nowrap tabular-nums max-md:order-2',
          transaction.amount > 0 && 'text-positive'
        )}
        data-field="amount"
      >
        {formatAmount(transaction.amount, { signed: true })}
      </div>
      <div
        role="cell"
        className="text-right whitespace-nowrap text-muted tabular-nums max-md:order-4 max-md:text-xs"
      >
        {formatAmount(transaction.total)}
      </div>
    </div>
  );
}
