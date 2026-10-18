import { useCallback, useId, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { FloatingPanel } from './FloatingPanel';

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
 * A button that opens a small panel of controls under it (a filter, say). It is a `FloatingPanel`, so a
 * virtualised or clipped parent cannot hide it. Escape or a click
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
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const id = useId();
  const dismiss = useCallback(() => onOpenChange(false), [onOpenChange]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;
    // Typing in the panel must not reach the page's shortcuts (Escape clears a selection).
    if (event.key === 'Escape') {
      event.nativeEvent.stopPropagation();
      onOpenChange(false);
      button?.focus();
    }
  };

  return (
    <div className={cn('inline-flex', className)} onKeyDown={onKeyDown}>
      <button
        ref={setButton}
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
      {open && (
        <FloatingPanel
          anchor={button}
          onDismiss={dismiss}
          placement={alignRight ? 'bottom-end' : 'bottom-start'}
          id={id}
          role="dialog"
          aria-label={label}
          className="p-3 text-sm font-normal tracking-normal text-fg normal-case"
          onKeyDown={onKeyDown}
          onPlaced={(panel) =>
            panel.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus()
          }
        >
          {panel}
        </FloatingPanel>
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
