import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { ActionButton } from '../../../ui/ActionButton';

interface PasteBoxProps {
  onText(text: string): void;
  /** Goes back to choosing a file. */
  onUseFile(): void;
}

/** A text area for transactions copied from a bank's website. Pasting reads them straight away. */
export function PasteBox({ onText, onUseFile }: PasteBoxProps) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');

  useEffect(() => field.current?.focus(), []);

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    // The text area has not updated yet, so read from the clipboard and merge with what is there.
    const pasted = event.clipboardData.getData('text');
    if (!pasted) return;
    const target = event.currentTarget;
    const next = text.slice(0, target.selectionStart) + pasted + text.slice(target.selectionEnd);
    onText(next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-line bg-surface p-4">
      <label className="flex flex-col gap-1">
        <span className="text-lg font-semibold">Paste transactions from your bank</span>
        <span className="text-sm text-muted">
          Select the transaction list on your bank&apos;s website or app, copy it, and paste it
          here. Navigation text and balances are ignored. You can check everything before it is
          added.
        </span>
        <textarea
          ref={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          rows={8}
          spellCheck={false}
          placeholder={
            '12 Oct 2026  TESCO STORES 3412  £23.45  £1,204.10\n13 Oct 2026  ACME SALARY  £2,400.00  £3,604.10'
          }
          className="mt-2 w-full resize-y rounded-lg border border-line bg-canvas p-2 font-mono text-sm text-fg placeholder:text-muted/70 focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          shortcut="import.readPaste"
          variant="primary"
          disabled={text.trim() === ''}
          onAction={() => onText(text)}
        >
          Read text
        </ActionButton>
        <ActionButton shortcut="import.chooseFile" variant="ghost" onAction={onUseFile}>
          Use a file instead
        </ActionButton>
      </div>
    </div>
  );
}
