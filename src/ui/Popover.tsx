import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

interface PopoverProps {
  /** Accessible name of the button, e.g. "Filter by date". */
  label: string;
  open: boolean;
  onOpenChange(open: boolean): void;
  /** What the button shows. */
  children: ReactNode;
  /** The panel's content. */
  panel: ReactNode;
  /** Tints the button, e.g. while a filter is switched on. */
  active?: boolean;
  /** Line the panel's right edge up with the button instead of its left edge. */
  alignRight?: boolean;
  className?: string;
}

/**
 * A button that opens a small panel of controls under it (a filter, say). The panel is portaled to
 * <body> like `Menu`'s list, so a virtualised or clipped parent cannot hide it. Escape or a click
 * outside closes it and puts focus back on the button.
 */
export function Popover({
  label,
  open,
  onOpenChange,
  children,
  panel,
  active,
  alignRight,
  className,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left?: number; right?: number }>();
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const rect = button.current!.getBoundingClientRect();
    const width = box.current?.offsetWidth ?? 0;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPlace({
      top: rect.bottom + 4,
      ...(alignRight ? { right: Math.max(8, window.innerWidth - rect.right) } : { left }),
    });
  }, [open, alignRight]);

  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !box.current?.contains(target)) onOpenChange(false);
    };
    // Scrolling the page would leave the panel behind; scrolling inside it is fine.
    const scrolled = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const width = window.innerWidth;
    const resized = () => {
      if (window.innerWidth !== width) onOpenChange(false);
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('resize', resized);
    };
  }, [open, onOpenChange]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;
    // Typing in the panel must not reach the page's shortcuts (Escape clears a selection).
    if (event.key === 'Escape') {
      event.nativeEvent.stopPropagation();
      onOpenChange(false);
      button.current?.focus();
    }
  };

  return (
    <div ref={root} className={cn('relative inline-flex', className)} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cn(
          'inline-flex size-5 cursor-pointer items-center justify-center rounded text-muted normal-case transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
          (active || open) && 'text-accent'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={box}
            id={id}
            role="dialog"
            aria-label={label}
            className="fixed z-50 w-max max-w-[calc(100vw-1rem)] rounded-lg border border-line bg-surface p-3 text-sm font-normal tracking-normal text-fg normal-case shadow-lg"
            style={{ ...place, visibility: place ? undefined : 'hidden' }}
            onKeyDown={onKeyDown}
          >
            {panel}
          </div>,
          document.body
        )}
    </div>
  );
}

export function FunnelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M1.5 2h13l-5 6.2V14l-3-1.6V8.2z" />
    </svg>
  );
}
