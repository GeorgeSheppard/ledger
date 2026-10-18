import { useSyncStatus } from '../../state/ledgerData';
import type { SyncStatus } from '../../lib/store/ledgerStore';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';

function describe(status: SyncStatus): string {
  switch (status.state) {
    case 'saved':
      return 'All changes saved';
    case 'unsaved':
      return 'Unsaved changes';
    case 'saving':
      return 'Saving…';
    case 'error':
      return 'Could not save';
  }
}

/**
 * Whether edits have reached Google Sheets, with a Save button. Edits also save themselves every
 * minute, so the button is for "save now".
 */
export function SaveStatus({ className }: { className?: string }) {
  const { status, save } = useSyncStatus();
  return (
    <div className={cn('flex flex-col gap-1 text-sm', className)} aria-live="polite">
      <span
        className={cn(status.state === 'error' ? 'text-negative' : 'text-muted')}
        title={status.state === 'error' ? status.message : undefined}
      >
        {describe(status)}
      </span>
      <ActionButton
        shortcut="sync.save"
        variant={status.state === 'unsaved' || status.state === 'error' ? 'primary' : 'secondary'}
        onAction={() => {
          save().catch(() => {
            // Shown through the status above; the edits stay and the next save retries.
          });
        }}
      >
        Save
      </ActionButton>
    </div>
  );
}
