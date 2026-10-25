import { useState } from 'react';
import { useSyncStatus } from '../../../state/ledgerData';
import type { SyncStatus } from '../../../lib/store/ledgerStore';
import { getBinding } from '../../../lib/shortcuts/bindings';
import { formatKeys } from '../../../lib/shortcuts/keys';
import { useIsMac, useShortcut } from '../../../state/shortcuts';
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

export interface SaveAction {
  /** What the action is called: Save, or Download for a ledger kept in a file. */
  label: string;
  /** The action's name with its shortcut, for a menu item. */
  menuLabel: string;
  run(): void;
  /** What the status says, e.g. "Unsaved changes". */
  text: string;
  /** Whether the status is worth showing (anything but "all saved"). */
  attention: boolean;
  /** What went wrong, if something did. */
  error: string | null;
  state: SyncStatus['state'];
}

/**
 * Save now (Google Sheets; edits also save themselves every minute) or, for a ledger kept in a
 * file, download the updated file. Registers Ctrl+S, so call it once, wherever the action lives.
 */
export function useSaveAction(): SaveAction {
  const { status, isFile, save, download } = useSyncStatus();
  const isMac = useIsMac();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const error = status.state === 'error' ? status.message : downloadError;
  const run = () => {
    if (!isFile)
      return void save().catch(() => {
        // Shown through the status; the edits stay and the next save retries.
      });
    setDownloadError(null);
    download().then(saveToDevice, (e: unknown) =>
      setDownloadError(e instanceof Error ? e.message : String(e))
    );
  };
  useShortcut('sync.save', run);
  const label = isFile ? 'Download' : 'Save';
  const keys = formatKeys(getBinding('sync.save').keys, isMac)
    .map((key) => key.label)
    .join(' ');
  return {
    label,
    menuLabel: `${label} (${keys})`,
    run,
    text: error && isFile ? 'Could not build the file' : describe(status, isFile),
    attention: status.state !== 'saved' || error !== null,
    error,
    state: status.state,
  };
}
