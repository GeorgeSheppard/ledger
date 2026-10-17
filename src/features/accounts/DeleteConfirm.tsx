import type { ShortcutId } from '../../lib/shortcuts/bindings';
import { ActionButton } from '../../ui/ActionButton';

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
    <div
      className="mt-0.5 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-negative/40 bg-negative/10 px-3 py-2"
      role="alertdialog"
      aria-label="Confirm delete"
    >
      <span className="text-sm">{message}</span>
      <div className="flex gap-2">
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
