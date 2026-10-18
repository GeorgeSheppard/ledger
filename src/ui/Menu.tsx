import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

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
}

/**
 * A button that opens a small list of actions. Arrow keys move, Enter picks, Escape or a click
 * outside closes it and puts focus back on the button.
 */
export function Menu({ label, items, children, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top?: number; bottom?: number; right: number }>();
  const listId = useId();

  // The list is portaled to <body> and positioned against the viewport: inside a virtualised row
  // (which has a transform, so its own stacking context) later rows would paint over it, and the
  // scroll container would clip it.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = button.current!.getBoundingClientRect();
    const height = list.current?.offsetHeight ?? 0;
    const flip = rect.bottom + height + 8 > window.innerHeight && rect.top > height + 8;
    setPlace({
      right: window.innerWidth - rect.right,
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    // Only a width change moves the button horizontally; a height change (e.g. the mobile address
    // bar) leaves the right-anchored list where it is.
    const width = window.innerWidth;
    const resized = () => {
      if (window.innerWidth !== width) dismiss();
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', resized);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', resized);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
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
    <div ref={root} className={cn('relative', className)} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        onClick={(event) => {
          event.stopPropagation();
          setPlace(undefined);
          setOpen((o) => !o);
        }}
      >
        {children ?? <MoreIcon />}
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            id={listId}
            role="menu"
            aria-label={label}
            className="fixed z-50 min-w-56 rounded-lg border border-line bg-surface p-1 shadow-lg"
            style={{ ...place, visibility: place ? undefined : 'hidden' }}
            onKeyDown={onKeyDown}
          >
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
          </div>,
          document.body
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
