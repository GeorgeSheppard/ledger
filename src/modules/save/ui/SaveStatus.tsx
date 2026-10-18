import { useState } from 'react';
import { useSyncStatus } from '../../../state/ledgerData';
import type { SyncStatus } from '../../../lib/store/ledgerStore';
import { ActionButton } from '../../../ui/ActionButton';
import { cn } from '../../../ui/cn';
import { saveToDevice } from './downloadFile';

function describe(status: SyncStatus, isFile: boolean): string {
  switch (status.state) {
    case 'saved':
      if (!isFile) return 'All changes saved';
      return status.savedAt === null ? 'No changes yet' : 'Downloaded';
    case 'unsaved':
      return isFile ? 'Not downloaded yet' : 'Unsaved changes';
    case 'saving':
      return isFile ? 'Preparing file…' : 'Saving…';
    case 'error':
      return isFile ? 'Could not build the file' : 'Could not save';
  }
}

/**
 * Whether edits have reached Google Sheets, with a Save button. Edits also save themselves every
 * minute, so the button is for "save now". For a ledger kept in a file there is no autosave: the
 * button downloads the updated file, and the status says whether the latest changes are in it.
 */
export function SaveStatus({ className }: { className?: string }) {
  const { status, isFile, save, download } = useSyncStatus();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const error = status.state === 'error' ? status.message : downloadError;
  return (
    <div className={cn('flex flex-col gap-1 text-sm', className)} aria-live="polite">
      <span className={cn(error ? 'text-negative' : 'text-muted')} title={error ?? undefined}>
        {error && isFile ? 'Could not build the file' : describe(status, isFile)}
      </span>
      <ActionButton
        shortcut="sync.save"
        variant={status.state === 'unsaved' || error ? 'primary' : 'secondary'}
        onAction={() => {
          if (!isFile)
            return void save().catch(() => {
              // Shown through the status above; the edits stay and the next save retries.
            });
          setDownloadError(null);
          download().then(saveToDevice, (e: unknown) =>
            setDownloadError(e instanceof Error ? e.message : String(e))
          );
        }}
      >
        {isFile ? 'Download' : 'Save'}
      </ActionButton>
    </div>
  );
}
