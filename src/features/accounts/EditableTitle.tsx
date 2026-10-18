import { useState, type KeyboardEvent } from 'react';
import { validateAccountName } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { cn } from '../../ui/cn';

interface EditableTitleProps {
  account: Account;
  accounts: Account[];
  disabled?: boolean;
  onRename(name: string): Promise<void>;
}

const TITLE = 'text-2xl font-semibold tracking-tight';

/** The account name as a heading: click it to edit in place. Enter or clicking away saves, Esc cancels. */
export function EditableTitle({ account, accounts, disabled, onRename }: EditableTitleProps) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stop = () => {
    setName(null);
    setError(null);
  };

  const commit = async () => {
    if (name === null || saving) return;
    if (name.trim() === account.name || !name.trim()) return stop();
    const problem = validateAccountName(accounts, name, account.id);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await onRename(name.trim());
      stop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      stop();
    }
  };

  if (name === null)
    return (
      <h1 className={TITLE}>
        <button
          type="button"
          disabled={disabled}
          title="Click to rename"
          className="-mx-2 cursor-text rounded-lg px-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default"
          onClick={() => setName(account.name)}
        >
          {account.name}
        </button>
      </h1>
    );

  return (
    <div>
      <input
        autoFocus
        aria-label="Account name"
        aria-invalid={!!error || undefined}
        className={cn(
          TITLE,
          '-mx-2 w-80 max-w-full rounded-lg border border-line bg-canvas px-2 focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none aria-invalid:border-negative'
        )}
        value={name}
        disabled={saving}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        onFocus={(e) => e.currentTarget.select()}
      />
      {error && (
        <p className="mt-1 text-sm text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
