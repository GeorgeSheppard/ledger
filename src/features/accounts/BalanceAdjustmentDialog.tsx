import { useId, useMemo, useState } from 'react';
import type { Account, Transaction } from '../../lib/domain/types';
import { planBalanceAdjustment } from '../../lib/transactions/adjustment';
import { formatAmount, parseAmount } from '../../lib/transactions/amount';
import { isIsoDate, todayIso } from '../../lib/transactions/dates';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';
import { Dialog } from '../../ui/Dialog';
import { Select } from '../../ui/Select';
import { TextInput } from '../../ui/TextInput';
import { useAccountActions } from './useAccountsData';

interface BalanceAdjustmentDialogProps {
  accounts: Account[];
  /** Every account's transactions, by account id. */
  transactionsByAccount: Readonly<Record<number, Transaction[]>>;
  /** The account to start on, when the page is showing one. */
  initialAccountId?: number;
  onClose(): void;
}

/**
 * Sets an account to the balance the user reads off their bank. Shows the difference it will add
 * before anything is saved, then adds one ordinary row for it (see `lib/transactions/adjustment.ts`).
 */
export function BalanceAdjustmentDialog({
  accounts,
  transactionsByAccount,
  initialAccountId,
  onClose,
}: BalanceAdjustmentDialogProps) {
  const actions = useAccountActions();
  const ids = useId();
  const [accountId, setAccountId] = useState<number | undefined>(
    initialAccountId ?? accounts[0]?.id
  );
  const [date, setDate] = useState(todayIso);
  const [balance, setBalance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const target = parseAmount(balance);
  const plan = useMemo(
    () =>
      account && target !== null && isIsoDate(date)
        ? planBalanceAdjustment(account, transactionsByAccount[account.id] ?? [], date, target)
        : null,
    [account, target, date, transactionsByAccount]
  );
  const unchanged = account && target !== null && isIsoDate(date) && plan === null;

  const save = async () => {
    if (!account || !plan || saving) return;
    setSaving(true);
    setError(null);
    try {
      await actions.adjustBalance(account.id, plan.input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Balance adjustment"
      description="Enter what the account holds now. Ledger adds one transaction for the difference, so the balance matches."
      onClose={onClose}
      className="w-[min(28rem,calc(100vw-32px))]"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${ids}-account`}>
          Account
          <Select
            id={`${ids}-account`}
            value={accountId ?? ''}
            onChange={(e) => setAccountId(Number(e.target.value))}
            className="h-9"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${ids}-date`}>
          Balance as of
          <TextInput
            id={`${ids}-date`}
            type="date"
            value={date}
            aria-invalid={!isIsoDate(date) || undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${ids}-balance`}>
          Actual balance
          <TextInput
            id={`${ids}-balance`}
            className="text-right tabular-nums"
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            value={balance}
            aria-invalid={(balance.trim() !== '' && target === null) || undefined}
            onChange={(e) => setBalance(e.target.value)}
          />
        </label>

        <p
          className={cn(
            'rounded-md border-2 border-rule bg-surface px-3 py-2 text-sm text-muted',
            plan && 'text-fg'
          )}
          aria-live="polite"
        >
          {plan ? (
            <>
              The balance on this date is {formatAmount(plan.current)}. Ledger will add{' '}
              <strong className={cn('tabular-nums', plan.difference < 0 && 'text-negative')}>
                {formatAmount(plan.difference, { signed: true })}
              </strong>{' '}
              as “Balance adjustment”. It counts as {plan.difference > 0 ? 'income' : 'spending'}.
            </>
          ) : unchanged ? (
            'The balance already matches. Nothing to add.'
          ) : (
            'Enter the balance to see the adjustment.'
          )}
        </p>
        {error && (
          <p className="text-sm text-negative" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <ActionButton variant="ghost" onAction={onClose}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" variant="primary" disabled={!plan || saving} onAction={save}>
            {saving ? 'Adding…' : 'Add adjustment'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  );
}
