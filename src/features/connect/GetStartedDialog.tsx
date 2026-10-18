import { useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { INGEST_OPTIONS, type IngestOption } from '../../modules/ingest';
import { ActionButton } from '../../ui/ActionButton';
import { Dialog } from '../../ui/Dialog';

/**
 * Choose how to bring your data in, then follow that option's steps. The choices come from the
 * ingest registry, so a new ingest module shows up here without any change to this file.
 */
export function GetStartedDialog({ onClose }: { onClose(): void }) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<IngestOption | null>(null);

  return (
    <Dialog
      title={chosen ? chosen.title : 'How do you want to start?'}
      description={chosen ? undefined : 'Pick where your ledger will live. You can switch later.'}
      onClose={onClose}
    >
      {chosen ? (
        <div className="flex flex-col gap-4">
          <div>
            <ActionButton variant="ghost" onAction={() => setChosen(null)}>
              ← All options
            </ActionButton>
          </div>
          <chosen.Setup
            onOpened={() => {
              onClose();
              navigate(paths.home);
            }}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {INGEST_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setChosen(option)}
                className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="font-semibold">{option.title}</span>
                <span className="text-sm text-muted">{option.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
