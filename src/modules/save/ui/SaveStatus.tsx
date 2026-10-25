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
export function SaveStatus({
  className,
  buttonClassName,
  labelClassName,
}: {
  className?: string;
  buttonClassName?: string;
  labelClassName?: string;
}) {
  const { status, isFile, save, download } = useSyncStatus();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const error = status.state === 'error' ? status.message : downloadError;
  const dot = error
    ? 'bg-negative'
    : status.state === 'unsaved'
      ? 'bg-accent'
      : status.state === 'saving'
        ? 'animate-pulse bg-muted'
        : 'bg-positive';
  return (
    <div className={cn('flex flex-col gap-2 text-sm', className)}>
      <div className="flex items-center gap-2" aria-live="polite" title={error ?? undefined}>
        <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
        <span className={cn(error && 'text-negative', labelClassName)}>
          {error && isFile ? 'Could not build the file' : describe(status, isFile)}
        </span>
      </div>
      <ActionButton
        shortcut="sync.save"
        hideHint
        className={buttonClassName}
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
