import { useState, type KeyboardEvent } from 'react';
import { validateAccountName } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { TextInput } from '../../ui/TextInput';

interface AccountNameFormProps {
  accounts: Account[];
  /** The account being renamed; omit when creating a new one. */
  account?: Account;
  onSubmit(name: string): Promise<void>;
  onCancel(): void;
}

/** Inline name input for creating or renaming an account. Enter saves, Escape cancels. */
export function AccountNameForm({ accounts, account, onSubmit, onCancel }: AccountNameFormProps) {
  const [name, setName] = useState(account?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problem = validateAccountName(accounts, name, account?.id);
    if (problem) return setError(problem);
    if (account && name.trim() === account.name) return onCancel();
    setSaving(true);
    try {
      await onSubmit(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onCancel();
  };

  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TextInput
        className="h-9 w-80 max-w-full"
        aria-label={account ? 'Account name' : 'New account name'}
        aria-invalid={!!error || undefined}
        placeholder="e.g. Credit card"
        value={name}
        disabled={saving}
        autoFocus
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => !saving && !name.trim() && onCancel()}
      />
      {error ? (
        <span className="text-sm text-negative" role="alert">
          {error}
        </span>
      ) : (
        <span className="text-sm text-muted">
          Enter to {account ? 'rename' : 'create'}, Esc to cancel
        </span>
      )}
    </form>
  );
}
