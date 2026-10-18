import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterAccounts } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';

const OPTION = 'flex items-center justify-between rounded-md px-2.5 py-2 text-sm';

interface AccountSwitcherProps {
  accounts: Account[];
  /** `null` when the combined "All accounts" list is open. */
  current: Account | null;
  disabled?: boolean;
  onSelect(account: Account): void;
  /** Opens the combined list of every account; the menu offers it as "All accounts". */
  onSelectAll(): void;
  /** Absent where there is no account form to open; the menu then has no "New account" entry. */
  onNew?(): void;
}

/** The combined list's place in the menu, ahead of the real accounts. */
const ALL_ACCOUNTS = 'All accounts';

/** Menu for jumping to another account. `/` opens it; type to filter, arrows and Enter to switch. */
export function AccountSwitcher({
  accounts,
  current,
  disabled,
  onSelect,
  onSelectAll,
  onNew,
}: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionId = (account: Account | null) => `${listId}-${account ? account.id : 'all'}`;

  /** `null` is "All accounts", listed first while the search still matches its name. */
  const matches = useMemo<(Account | null)[]>(() => {
    const found = filterAccounts(accounts, query);
    return ALL_ACCOUNTS.toLowerCase().includes(query.trim().toLowerCase())
      ? [null, ...found]
      : found;
  }, [accounts, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const show = () => {
    setQuery('');
    setActive(current ? Math.max(0, accounts.findIndex((a) => a.id === current.id) + 1) : 0);
    setOpen(true);
  };

  const choose = (account: Account | null | undefined) => {
    setOpen(false);
    if (account === null) onSelectAll();
    else if (account) onSelect(account);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const n = Math.max(1, matches.length);
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <ActionButton
        shortcut="accounts.switch"
        variant="ghost"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onAction={() => (open ? setOpen(false) : show())}
      >
        Switch account
        <span className="ml-1.5 text-xs text-muted" aria-hidden="true">
          ▾
        </span>
      </ActionButton>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <input
            className="h-9 w-full border-b border-line bg-transparent px-2.5 text-sm text-fg outline-none placeholder:text-muted/70"
            aria-label="Find account"
            aria-controls={listId}
            aria-activedescendant={
              matches[active] !== undefined ? optionId(matches[active]) : undefined
            }
            placeholder="Find account…"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul id={listId} role="listbox" className="my-1.5 max-h-72 overflow-y-auto">
            {matches.map((account, i) => {
              const isCurrent = account ? account.id === current?.id : current === null;
              return (
                <li
                  key={account ? account.id : 'all'}
                  id={optionId(account)}
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    OPTION,
                    'cursor-pointer',
                    i === active && 'bg-surface-hover',
                    isCurrent && 'font-semibold'
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(account)}
                >
                  {account ? account.name : ALL_ACCOUNTS}
                  {isCurrent && (
                    <span className="text-accent" aria-label="current">
                      ✓
                    </span>
                  )}
                </li>
              );
            })}
            {matches.length === 0 && (
              <li className={cn(OPTION, 'text-muted')}>No accounts match</li>
            )}
          </ul>
          {onNew && (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center border-t border-line px-2.5 pt-2 pb-1 text-sm text-accent hover:text-accent-hover"
              onClick={() => {
                setOpen(false);
                onNew();
              }}
            >
              <span>+ New account</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
