import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { FloatingPanel } from './FloatingPanel';

export interface MenuItem {
  label: string;
  onSelect(): void;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separated?: boolean;
}

interface MenuProps {
  /** Accessible name of the button, e.g. "Actions for Tesco". */
  label: string;
  items: readonly MenuItem[];
  /** What the button shows; defaults to a "more" icon. */
  children?: ReactNode;
  className?: string;
  /** Replaces the round icon-button look, e.g. for a menu that opens from a text button. */
  buttonClassName?: string;
}

/**
 * A button that opens a small list of actions. Arrow keys move, Enter picks, Escape or a click
 * outside closes it and puts focus back on the button.
 */
export function Menu({ label, items, children, className, buttonClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();
  const dismiss = useCallback(() => setOpen(false), []);

  const close = () => {
    setOpen(false);
    button?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ') event.nativeEvent.stopPropagation();
      return;
    }
    // Keys the menu uses must not also reach the page's shortcuts (Escape clears a selection,
    // Enter edits it, and the shortcut handler would cancel the item's own Enter).
    if (['Escape', 'Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key))
      event.nativeEvent.stopPropagation();
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') return;
    const enabled = [
      ...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []),
    ];
    const index = enabled.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') enabled[(index + 1) % enabled.length]?.focus();
    else if (event.key === 'ArrowUp')
      enabled[(index - 1 + enabled.length) % enabled.length]?.focus();
    else if (event.key === 'Tab') setOpen(false);
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <div className={className} onKeyDown={onKeyDown}>
      <button
        ref={setButton}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
          buttonClassName
        )}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children ?? <MoreIcon />}
      </button>
      {open && (
        <FloatingPanel
          anchor={button}
          onDismiss={dismiss}
          placement="bottom-end"
          className="min-w-56 p-1"
          maxHeight="24rem"
          onPlaced={() =>
            list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
          }
        >
          <div ref={list} id={listId} role="menu" aria-label={label} onKeyDown={onKeyDown}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  'block w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus:bg-surface-hover focus:outline-none hover:enabled:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50',
                  item.danger && 'text-negative',
                  item.separated && 'mt-1 border-t border-line pt-2'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}
