import { useRef, useState, type DragEvent } from 'react';
import { ActionButton } from '../../../ui/ActionButton';
import { Card } from '../../../ui/Card';
import { cn } from '../../../ui/cn';
import { useSession } from '../../../state/session';
import { useAsyncAction } from '../../../features/connect/useAsyncAction';

/**
 * Use Ledger without Google: drop a spreadsheet file here or choose one, or start with a blank
 * ledger. The file is read in the browser and never uploaded; the Save button becomes Download.
 */
export function LocalFileCard({
  scope,
  onOpened,
  className,
}: {
  scope: 'landing' | 'connect';
  /** Called once a file or blank ledger is open (the connect page uses it to leave the page). */
  onOpened?(): void;
  className?: string;
}) {
  const { openFile, startBlankFile } = useSession();
  const { busy, error, run } = useAsyncAction<'open'>();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const open = (file: File) =>
    run('open', async () => {
      await openFile(file);
      onOpened?.();
    });

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void open(file);
  };

  return (
    <Card
      className={cn(
        'flex flex-col items-start gap-3 border-2 border-dashed p-6 transition-colors',
        dragging && 'border-accent bg-accent/8',
        className
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <h2 className="text-lg font-semibold">Or use a spreadsheet file</h2>
      <p className="text-sm text-muted">
        Drop an <strong className="text-fg">.xlsx</strong> or{' '}
        <strong className="text-fg">.csv</strong> file here, in the same layout as the Google Sheet.
        It is opened in your browser and never uploaded. When you are done, download the updated
        file instead of saving to Google.
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          shortcut={`${scope}.openFile`}
          onAction={() => input.current?.click()}
          disabled={busy !== null}
        >
          {busy ? 'Opening…' : 'Choose file'}
        </ActionButton>
        <ActionButton
          shortcut={`${scope}.blank`}
          variant="ghost"
          onAction={() => {
            startBlankFile();
            onOpened?.();
          }}
          disabled={busy !== null}
        >
          Start a blank ledger
        </ActionButton>
      </div>
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
      {error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}
    </Card>
  );
}
