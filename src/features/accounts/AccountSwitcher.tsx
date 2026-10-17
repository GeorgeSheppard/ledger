import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterAccounts } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { Kbd } from '../../ui/Kbd';
import { cn } from '../../ui/cn';

const OPTION = 'flex items-center justify-between rounded-md px-2.5 py-2 text-sm';

interface AccountSwitcherProps {
  accounts: Account[];
  current: Account;
  onSelect(account: Account): void;
  onNew(): void;
}

/** Menu for jumping to another account. `/` opens it; type to filter, arrows and Enter to switch. */
export function AccountSwitcher({ accounts, current, onSelect, onNew }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => filterAccounts(accounts, query), [accounts, query]);

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
    setActive(
      Math.max(
        0,
        accounts.findIndex((a) => a.id === current.id)
      )
    );
    setOpen(true);
  };

  const choose = (account: Account | undefined) => {
    setOpen(false);
    if (account) onSelect(account);
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
            aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
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
            {matches.map((account, i) => (
              <li
                key={account.id}
                id={`${listId}-${account.id}`}
                role="option"
                aria-selected={i === active}
                className={cn(
                  OPTION,
                  'cursor-pointer',
                  i === active && 'bg-surface-hover',
                  account.id === current.id && 'font-semibold'
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(account)}
              >
                {account.name}
                {account.id === current.id && (
                  <span className="text-accent" aria-label="current">
                    ✓
                  </span>
                )}
              </li>
            ))}
            {matches.length === 0 && (
              <li className={cn(OPTION, 'text-muted')}>No accounts match</li>
            )}
          </ul>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between border-t border-line px-2.5 pt-2 pb-1 text-sm text-accent hover:text-accent-hover"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
          >
            <span>+ New account</span>
            <Kbd shortcut="accounts.new" />
          </button>
        </div>
      )}
    </div>
  );
}
