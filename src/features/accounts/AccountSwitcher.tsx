import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterAccounts } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { Kbd } from '../../ui/Kbd';
import './AccountSwitcher.css';

interface AccountSwitcherProps {
  accounts: Account[];
  current: Account;
  onSelect(account: Account): void;
  onNew(): void;
}

/** The account name as a menu button. `/` opens it; type to filter, arrows and Enter to switch. */
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
    <div className="account-switcher" ref={rootRef}>
      <ActionButton
        shortcut="accounts.switch"
        variant="ghost"
        className="account-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onAction={() => (open ? setOpen(false) : show())}
      >
        <span className="account-switcher__name">{current.name}</span>
        <span className="account-switcher__chevron" aria-hidden="true">
          ▾
        </span>
      </ActionButton>
      {open && (
        <div className="account-switcher__panel">
          <input
            className="account-switcher__search"
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
          <ul id={listId} role="listbox" className="account-switcher__list">
            {matches.map((account, i) => (
              <li
                key={account.id}
                id={`${listId}-${account.id}`}
                role="option"
                aria-selected={i === active}
                className={[
                  'account-switcher__option',
                  i === active && 'account-switcher__option--active',
                  account.id === current.id && 'account-switcher__option--current',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(account)}
              >
                {account.name}
                {account.id === current.id && (
                  <span className="account-switcher__check" aria-label="current">
                    ✓
                  </span>
                )}
              </li>
            ))}
            {matches.length === 0 && (
              <li className="account-switcher__option account-switcher__empty">
                No accounts match
              </li>
            )}
          </ul>
          <button
            type="button"
            className="account-switcher__new"
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
