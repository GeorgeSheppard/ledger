import { Link } from 'react-router';
import { paths } from '../../app/paths';
import type { AccountSummary } from '../../lib/metrics/dashboard';
import { formatChange, formatMoney } from './format';

/** Each account's balance at the end of the latest month, linking to its transactions. */
export function AccountBalances({ accounts }: { accounts: AccountSummary[] }) {
  return (
    <ul className="account-balances">
      {accounts.map(({ account, balance, change }) => (
        <li key={account.id}>
          <Link className="account-balances__item" to={paths.account(account.id)}>
            <span className="account-balances__name">{account.name}</span>
            <span className="account-balances__balance">{formatMoney(balance)}</span>
            <span
              className={`account-balances__change account-balances__change--${
                change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
              }`}
            >
              {formatChange(change)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
