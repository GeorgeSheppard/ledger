import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { getBinding, type ShortcutId } from '../lib/shortcuts/bindings';
import { useShortcut } from '../state/shortcuts';
import { Kbd } from './Kbd';
import './ActionButton.css';

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** The shortcut that triggers this button. Its keys are shown on the button. */
  shortcut: ShortcutId;
  onAction(): void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
      className={['action-button', `action-button--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      onClick={onAction}
      title={rest.title ?? getBinding(shortcut).description}
    >
      <span>{children}</span>
      <Kbd shortcut={shortcut} />
    </button>
  );
}
