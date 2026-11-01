import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { filterAccounts } from '../../lib/accounts/accounts';
import type { Account } from '../../lib/domain/types';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';
import { FloatingPanel } from '../../ui/FloatingPanel';

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
  const listRef = useRef<HTMLUListElement>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const optionId = (account: Account | null) => `${listId}-${account ? account.id : 'all'}`;

  /** `null` is "All accounts", listed first while the search still matches its name. */
  const matches = useMemo<(Account | null)[]>(() => {
    const found = filterAccounts(accounts, query);
    return ALL_ACCOUNTS.toLowerCase().includes(query.trim().toLowerCase())
      ? [null, ...found]
      : found;
  }, [accounts, query]);

  // Keep the highlighted option in view. Scroll the list itself rather than calling
  // scrollIntoView, which can also scroll the page and make the panel close (it dismisses on scroll).
  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[active] as HTMLElement | undefined;
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [active, matches, open]);

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
    } else if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      setActive((i) =>
        Math.min(
          Math.max(0, matches.length - 1),
          Math.max(0, i + (event.key === 'PageDown' ? 8 : -8))
        )
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={setAnchor}>
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
        <FloatingPanel
          anchor={anchor}
          onDismiss={dismiss}
          placement="bottom-end"
          className="flex w-72 flex-col rounded-xl p-1.5 shadow-xl"
          onPlaced={(panel) => panel.querySelector('input')?.focus()}
        >
          <input
            className="h-9 w-full border-b border-line bg-transparent px-2.5 text-sm text-fg outline-none placeholder:text-muted/70"
            aria-label="Find account"
            aria-controls={listId}
            aria-activedescendant={
              matches[active] !== undefined ? optionId(matches[active]) : undefined
            }
            placeholder="Find account…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="relative my-1.5 max-h-72 min-h-0 flex-1 overflow-y-auto"
          >
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
        </FloatingPanel>
      )}
    </div>
  );
}
