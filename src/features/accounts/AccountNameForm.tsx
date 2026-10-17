import { useState, type KeyboardEvent } from 'react';
import { validateAccountName } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import './inlineField.css';
import './AccountNameForm.css';

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
      className="account-name-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        className="inline-field account-name-form__input"
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
      <span className="key-hint">
        {error ? (
          <span className="account-name-form__error" role="alert">
            {error}
          </span>
        ) : (
          <>
            <kbd>↵</kbd> {account ? 'rename' : 'create'} <kbd>Esc</kbd> cancel
          </>
        )}
      </span>
    </form>
  );
}
