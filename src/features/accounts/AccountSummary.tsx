import type { Transaction } from '../../lib/domain/types';
import { formatAmount } from '../../lib/transactions/amount';
import { todayIso } from '../../lib/transactions/dates';
import { summarizeAccount } from '../../lib/transactions/display';
import './AccountSummary.css';

/** Balance and this month's money in and out for one account. */
export function AccountSummary({ transactions }: { transactions: Transaction[] }) {
  const summary = summarizeAccount(transactions, todayIso());
  return (
    <dl className="account-summary">
      <div className="account-summary__item account-summary__item--balance">
        <dt>Balance</dt>
        <dd className={summary.balance < 0 ? 'account-summary__negative' : undefined}>
          {formatAmount(summary.balance)}
        </dd>
      </div>
      <div className="account-summary__item">
        <dt>In this month</dt>
        <dd className="account-summary__positive">
          {formatAmount(summary.monthIn, { signed: true })}
        </dd>
      </div>
      <div className="account-summary__item">
        <dt>Out this month</dt>
        <dd>{formatAmount(summary.monthOut)}</dd>
      </div>
      <div className="account-summary__item">
        <dt>Transactions</dt>
        <dd>{summary.count}</dd>
      </div>
    </dl>
  );
}
