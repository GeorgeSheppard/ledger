import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import type { AccountSummary } from '../../../lib/metrics/dashboard';
import { cn } from '../../../ui/cn';
import { formatChange, formatMoney } from '../shared/format';

/** Each account's balance at the end of the latest month, linking to its transactions. */
export function AccountBalances({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <ul className="-mx-3 flex flex-col gap-0.5">
      {accounts.map(({ account, balance, change }) => (
        <li key={account.id}>
          <Link
            className="grid grid-cols-[1fr_auto] gap-x-3 rounded-lg px-3 py-2 text-sm text-fg no-underline hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            to={paths.account(account.id)}
          >
            <span>{account.name}</span>
            <span className="text-right font-semibold tabular-nums">{formatMoney(balance)}</span>
            <span
              className={cn(
                'col-start-2 text-right text-muted tabular-nums',
                change > 0 && 'text-positive',
                change < 0 && 'text-negative'
              )}
            >
              {formatChange(change)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
