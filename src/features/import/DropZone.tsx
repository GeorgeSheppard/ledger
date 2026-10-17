import { useRef, useState, type DragEvent } from 'react';
import { ActionButton } from '../../ui/ActionButton';
import { cn } from '../../ui/cn';

interface DropZoneProps {
  onFile(file: File): void;
  /** Shrinks to a single line once a file is loaded. */
  compact?: boolean;
  fileName?: string;
}

/** Drag a CSV onto the page, or choose one with the button or `u`. */
export function DropZone({ onFile, compact, fileName }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={cn(
        'flex items-center rounded-xl border-2 border-dashed border-line bg-surface transition-colors',
        compact
          ? 'justify-between gap-4 border py-2 pr-2 pl-4'
          : 'flex-col gap-3 px-6 py-8 text-center',
        dragging && 'border-accent bg-accent/8'
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {compact ? (
        <p className="truncate text-sm font-medium">
          <span className="mr-2 text-xs font-semibold tracking-wide text-muted uppercase">
            File
          </span>
          {fileName}
        </p>
      ) : (
        <>
          <p className="text-lg font-semibold">Drop a CSV export from your bank here</p>
          <p className="max-w-[40ch] text-sm text-muted">
            We work out which columns hold the date, amount and description, and skip anything
            already in the account.
          </p>
        </>
      )}
      <ActionButton
        shortcut="import.chooseFile"
        variant={compact ? 'ghost' : 'primary'}
        onAction={() => input.current?.click()}
      >
        {compact ? 'Choose another file' : 'Choose file'}
      </ActionButton>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
