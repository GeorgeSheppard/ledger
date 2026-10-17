import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { useShortcut } from '../state/shortcuts';
import { cn } from './cn';
import { Kbd } from './Kbd';

const VARIANTS = {
  primary: 'border-accent bg-accent text-accent-fg hover:enabled:bg-accent-hover',
  secondary: 'border-line bg-surface text-fg hover:enabled:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-fg hover:enabled:bg-surface-hover',
  danger: 'border-line bg-surface text-negative hover:enabled:bg-surface-hover',
} as const;

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** The shortcut that triggers this button. Its keys are shown on the button. */
  shortcut: ShortcutId;
  onAction(): void;
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
}

/**
 * The standard button. Every action in the app has a shortcut, and the shortcut is always shown
 * with the button, so use this rather than a bare `<button>` for anything a user can do.
 */
export function ActionButton({
  shortcut,
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
        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className
      )}
      onClick={onAction}
      title={rest.title ?? getBinding(shortcut).description}
    >
      <span>{children}</span>
      <Kbd shortcut={shortcut} />
    </button>
  );
}
