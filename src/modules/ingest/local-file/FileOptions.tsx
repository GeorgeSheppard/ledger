import { useRef, useState, type DragEvent } from 'react';
import { useSession } from '../../../state/session';
import { ActionButton } from '../../../ui/ActionButton';
import { cn } from '../../../ui/cn';
import { useAsyncAction } from '../../../features/connect/useAsyncAction';
import type { IngestOption, IngestSetupProps } from '../types';

/** Drop or choose an `.xlsx` or `.csv`; it is read in the browser and never uploaded. */
function UploadSetup({ onOpened }: IngestSetupProps) {
  const { openFile } = useSession();
  const { busy, error, run } = useAsyncAction<'open'>();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = (file: File) =>
    run('open', async () => {
      await openFile(file);
      onOpened();
    });

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void open(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-line p-6 transition-colors',
          dragging && 'border-accent bg-accent/8'
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="text-sm text-muted">
          Drop an <strong className="text-fg">.xlsx</strong> or{' '}
          <strong className="text-fg">.csv</strong> file here, in the same layout as the Google
          Sheet. It is opened in your browser and never uploaded.
        </p>
        <ActionButton
          variant="primary"
          onAction={() => input.current?.click()}
          disabled={busy !== null}
        >
          {busy ? 'Opening…' : 'Choose file'}
        </ActionButton>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void open(file);
            event.target.value = '';
          }}
        />
      </div>
      <p className="text-sm text-muted">
        When you are done, download the updated file instead of saving to Google.
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

function BlankSetup({ onOpened }: IngestSetupProps) {
  const { startBlankFile } = useSession();
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted">
        Opens an empty ledger with one account and a starter set of categories. Nothing is saved
        online: use Download to keep your work as a spreadsheet file, and open that file next time.
      </p>
      <ActionButton
        variant="primary"
        onAction={() => {
          startBlankFile();
          onOpened();
        }}
      >
        Start a blank ledger
      </ActionButton>
    </div>
  );
}

export const uploadOption: IngestOption = {
  id: 'upload',
  title: 'Upload a spreadsheet',
  description: 'Open an .xlsx or .csv file from your device. It stays on your device.',
  Setup: UploadSetup,
};

export const blankOption: IngestOption = {
  id: 'blank',
  title: 'Start blank',
  description: 'Try Ledger with an empty ledger, with nothing to sign in to or upload.',
  Setup: BlankSetup,
};
