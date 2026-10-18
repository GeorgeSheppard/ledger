import type { Account } from '../../lib/domain/types';
import { Card } from '../../ui/Card';

interface AccountSettingsProps {
  account: Account;
  onInvertedChange(inverted: boolean): void;
}

/** The account's settings tab. Anything about how Ledger treats the account, rather than its rows, goes here. */
export function AccountSettings({ account, onInvertedChange }: AccountSettingsProps) {
  const inverted = !!account.inverted;
  return (
    <Card className="flex flex-col gap-4 px-4 py-4" aria-label={`${account.name} settings`}>
      {/* Credit card or loan: those tabs record amounts from the account's own side (a purchase is
          positive), so Ledger flips the sign when it counts the money. */}
      <label className="flex w-fit cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-accent"
          checked={inverted}
          onChange={(e) => onInvertedChange(e.target.checked)}
        />
        <span>
          <span className="font-medium">Credit card or loan</span>
          <span className="block text-xs text-muted">
            {inverted
              ? 'Amounts in the sheet are from the account’s side: a purchase is positive. Ledger counts them as money out and the balance as what you owe.'
              : 'Tick this if purchases are positive in this tab, so the balance counts against your net worth.'}
          </span>
        </span>
      </label>
    </Card>
  );
}
