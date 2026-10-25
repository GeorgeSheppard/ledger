import { useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import type { IngestOption } from '../../modules/ingest';
import { ActionButton } from '../../ui/ActionButton';
import { Dialog } from '../../ui/Dialog';
import { IngestOptionList } from './IngestOptionList';
import { useLastUsedIngest } from './useLastUsedIngest';

/**
 * Choose how to bring your data in, then follow that option's steps. The choices come from the
 * ingest registry, so a new ingest module shows up here without any change to this file. Pass
 * `initial` to skip straight to one option's steps.
 */
export function GetStartedDialog({
  onClose,
  initial = null,
}: {
  onClose(): void;
  initial?: IngestOption | null;
}) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<IngestOption | null>(initial);
  const { lastUsed, markUsed } = useLastUsedIngest();

  return (
    <Dialog
      title={chosen ? chosen.title : 'How do you want to start?'}
      description={chosen ? undefined : 'Pick where your ledger will live. You can switch later.'}
      onClose={onClose}
    >
      {chosen && 'Setup' in chosen ? (
        <div className="flex flex-col gap-4">
          <div>
            <ActionButton variant="ghost" onAction={() => setChosen(null)}>
              ← All options
            </ActionButton>
          </div>
          <chosen.Setup
            onUsed={() => markUsed(chosen.id)}
            onOpened={() => {
              markUsed(chosen.id);
              onClose();
              navigate(paths.home);
            }}
          />
        </div>
      ) : (
        <IngestOptionList lastUsed={lastUsed} onChoose={setChosen} onOpened={onClose} />
      )}
    </Dialog>
  );
}
