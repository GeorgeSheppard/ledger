import { ActionButton } from '../../../ui/ActionButton';
import { useSession } from '../../../state/session';
import type { IngestOption, IngestSetupProps } from '../types';

function ExampleSetup({ onOpened }: IngestSetupProps) {
  const { startExample } = useSession();
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted">
        Opens a made-up ledger with three accounts, a year of transactions, a full set of categories
        and monthly paychecks, so you can look around before preparing your own data. Nothing is
        signed in or saved. Use Download to get it as a spreadsheet and see the layout Ledger reads.
      </p>
      <ActionButton
        variant="primary"
        onAction={() => {
          startExample();
          onOpened();
        }}
      >
        Open the example ledger
      </ActionButton>
    </div>
  );
}

export const exampleOption: IngestOption = {
  id: 'example',
  title: 'Explore an example',
  description: 'Look around with made-up example data first. Nothing to sign in to or upload.',
  Setup: ExampleSetup,
};
