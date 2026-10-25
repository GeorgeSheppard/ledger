import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { useShortcut } from '../state/shortcuts';
import { cn } from './cn';
import { Kbd } from './Kbd';

const VARIANTS = {
  primary:
    'border-accent bg-accent font-semibold text-accent-fg hover:enabled:border-accent-hover hover:enabled:bg-accent-hover',
  secondary: 'border-rule bg-surface font-medium text-fg hover:enabled:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-fg hover:enabled:bg-surface-hover',
  danger: 'border-negative bg-surface font-medium text-negative hover:enabled:bg-surface-hover',
} as const;

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** The shortcut that triggers this button, shown on it. Leave out for rare actions. */
  shortcut?: ShortcutId;
  /** Keep the shortcut working but don't show it on the button. */
  hideHint?: boolean;
  onAction(): void;
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}

/**
 * The standard button. Frequent actions (editing transactions, saving) have a shortcut that is
 * always shown on the button; rare ones have none. Use this rather than a bare `<button>`.
 */
export function ActionButton({
  shortcut,
  hideHint,
  onAction,
  variant = 'secondary',
  disabled,
  children,
  className,
  ...rest
}: ActionButtonProps) {
  useShortcut(shortcut, onAction, !disabled);
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md border-2 px-2.5 py-1 text-sm transition-colors max-md:gap-1 max-md:px-2 max-md:py-1',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className
      )}
      onClick={onAction}
      title={rest.title ?? (shortcut ? getBinding(shortcut).description : undefined)}
    >
      <span>{children}</span>
      {shortcut && !hideHint && <Kbd shortcut={shortcut} />}
    </button>
  );
}
