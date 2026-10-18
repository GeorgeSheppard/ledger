import { useState } from 'react';
import { ledgerWithUnsavedChanges } from '../state/ledgerData';
import { useSession } from '../state/session';
import { saveToDevice } from '../modules/save/ui/downloadFile';
import { ActionButton } from '../ui/ActionButton';
import { Dialog } from '../ui/Dialog';
import { cn } from '../ui/cn';

type Step = 'closed' | 'unsaved' | 'sure';

/**
 * Leaves Ledger and clears everything it kept in this browser. With nothing to lose it exits at
 * once; with unsaved edits it first offers to save them, and discarding them takes a second,
 * explicit confirmation. Saving goes through the open ledger's own saver (Save to Google, or
 * Download for a file), so every source behaves the same.
 */
export function ExitButton({
  variant = 'ghost',
  className,
}: {
  variant?: 'ghost' | 'secondary';
  className?: string;
}) {
  const { exit } = useSession();
  const [step, setStep] = useState<Step>('closed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFile = ledgerWithUnsavedChanges()?.isFile ?? false;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const leave = () => run(exit);
  const saveAndLeave = () =>
    run(async () => {
      const store = ledgerWithUnsavedChanges();
      if (store) {
        if (store.isFile) await saveToDevice(await store.download());
        else await store.save();
      }
      await exit();
    });

  const cancel = () => {
    if (busy) return;
    setStep('closed');
    setError(null);
  };

  return (
    <>
      <ActionButton
        variant={variant}
        className={cn('whitespace-nowrap', className)}
        onAction={() => (ledgerWithUnsavedChanges() ? setStep('unsaved') : void leave())}
      >
        Exit
      </ActionButton>
      {step === 'unsaved' && (
        <Dialog
          title="Save your changes before exiting?"
          description={
            isFile
              ? 'Your changes only exist in this tab. Download the file to keep them.'
              : 'Your latest changes have not reached your Google Sheet yet.'
          }
          onClose={cancel}
          className="max-w-md"
        >
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton disabled={busy} onAction={cancel}>
              Cancel
            </ActionButton>
            <ActionButton variant="danger" disabled={busy} onAction={() => setStep('sure')}>
              Exit without saving
            </ActionButton>
            <ActionButton variant="primary" disabled={busy} onAction={() => void saveAndLeave()}>
              {isFile ? 'Download and exit' : 'Save and exit'}
            </ActionButton>
          </div>
        </Dialog>
      )}
      {step === 'sure' && (
        <Dialog
          title="Are you sure?"
          description="Your unsaved changes will be lost for good. Ledger also removes its copy of your data from this browser."
          onClose={cancel}
          className="max-w-md"
        >
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton disabled={busy} onAction={() => setStep('unsaved')}>
              Go back
            </ActionButton>
            <ActionButton variant="danger" disabled={busy} onAction={() => void leave()}>
              Yes, exit and discard
            </ActionButton>
          </div>
        </Dialog>
      )}
    </>
  );
}
