import type { Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { todayIso } from '../../lib/transactions/dates';
import { summarizeAccount } from '../../lib/transactions/display';
import { cn } from '../../ui/cn';

/** Balance and this month's money in and out for one account. */
export function AccountSummary({ transactions }: { transactions: Transaction[] }) {
  const summary = summarizeAccount(transactions, todayIso());
  const items = [
    {
      label: 'In this month',
      value: formatAmount(summary.monthIn, { signed: true }),
      positive: true,
    },
    { label: 'Out this month', value: formatAmount(summary.monthOut) },
    { label: 'Transactions', value: String(summary.count) },
  ];
  return (
    <dl className="flex flex-wrap items-end gap-x-8 gap-y-2">
      <div>
        <dt className="mb-0.5 text-xs text-muted">Balance</dt>
        <dd
          className={cn(
            'text-3xl font-semibold tracking-tight tabular-nums',
            summary.balance < 0 && 'text-negative'
          )}
        >
          {formatAmount(summary.balance)}
        </dd>
      </div>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="mb-0.5 text-xs text-muted">{item.label}</dt>
          <dd className={cn('tabular-nums', item.positive && 'text-positive')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
