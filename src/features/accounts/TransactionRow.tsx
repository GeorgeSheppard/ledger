import type { MouseEvent } from 'react';
import type { Category, Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { formatDay } from '../../lib/transactions/dates';
import type { DraftField } from '../../lib/transactions/draft';
import { CategoryChip } from '../categories/CategoryChip';
import './TransactionRow.css';

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
  const direction = transaction.amount < 0 ? 'out' : 'in';

  return (
    <div
      role="row"
      aria-selected={selected}
      data-row-id={transaction.id}
      className={['transaction-row', selected && 'transaction-row--selected']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <div role="cell" className="transaction-row__date" data-field="date">
        {formatDay(transaction.date)}
      </div>
      <div role="cell" className="transaction-row__category" data-field="category">
        <CategoryChip name={transaction.category} categories={categories} />
      </div>
      <div role="cell" className="transaction-row__note" data-field="note">
        {transaction.note || <span className="transaction-row__empty">No note</span>}
      </div>
      <div
        role="cell"
        className={`transaction-row__amount transaction-row__amount--${direction}`}
        data-field="amount"
      >
        {formatAmount(transaction.amount, { signed: true })}
      </div>
      <div role="cell" className="transaction-row__total">
        {formatAmount(transaction.total)}
      </div>
    </div>
  );
}
