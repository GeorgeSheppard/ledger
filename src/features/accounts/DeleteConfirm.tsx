import type { ShortcutId } from '../../lib/shortcuts/bindings';
import { ActionButton } from '../../ui/ActionButton';
import './DeleteConfirm.css';

interface DeleteConfirmProps {
  message: string;
  /** The same shortcut that asked for the delete, so pressing it twice confirms. */
  deleteShortcut: ShortcutId;
  cancelShortcut: ShortcutId;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/** Inline confirmation shown under a row that is about to be deleted. */
export function DeleteConfirm({
  message,
  deleteShortcut,
  cancelShortcut,
  busy,
  onConfirm,
  onCancel,
}: DeleteConfirmProps) {
  return (
    <div className="delete-confirm" role="alertdialog" aria-label="Confirm delete">
      <span className="delete-confirm__message">{message}</span>
      <div className="delete-confirm__actions">
        <ActionButton shortcut={cancelShortcut} variant="ghost" onAction={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton
          shortcut={deleteShortcut}
          variant="danger"
          disabled={busy}
          onAction={onConfirm}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </ActionButton>
      </div>
    </div>
  );
}
