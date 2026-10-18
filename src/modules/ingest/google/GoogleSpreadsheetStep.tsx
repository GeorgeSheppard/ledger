import { useEffect, useState } from 'react';
import { useSession } from '../../../state/session';
import { ActionButton } from '../../../ui/ActionButton';
import { Card } from '../../../ui/Card';
import { useAsyncAction } from '../../../features/connect/useAsyncAction';
import { DEFAULT_SPREADSHEET_TITLE } from './newSpreadsheet';

/** Signed in with Google: create a new spreadsheet or pick one from Drive. */
export function GoogleSpreadsheetStep({ onOpened }: { onOpened(): void }) {
  const { spreadsheets, connect } = useSession();
  const [title, setTitle] = useState(DEFAULT_SPREADSHEET_TITLE);
  const { busy, error, run } = useAsyncAction<'pick' | 'create'>();

  useEffect(() => spreadsheets.preload?.(), [spreadsheets]);

  const open = (key: 'pick' | 'create') =>
    run(key, async () => {
      const spreadsheet =
        key === 'pick' ? await spreadsheets.pick() : await spreadsheets.create(title);
      if (!spreadsheet) return;
      await connect(spreadsheet);
      onOpened();
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Each tab in the spreadsheet is an account, with the columns{' '}
        <strong className="text-fg">Date, Category, Amount, Note, Total</strong>.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col items-start gap-3 p-5">
          <h3 className="font-semibold">Start fresh</h3>
          <p className="flex-1 text-sm text-muted">
            Creates a new spreadsheet with a <em>Current account</em> tab and a starter set of
            categories. You can add more accounts later.
          </p>
          <form
            className="flex w-full flex-col items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void open('create');
            }}
          >
            <label className="text-sm text-muted" htmlFor="new-sheet-title">
              Spreadsheet name
            </label>
            <input
              id="new-sheet-title"
              className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              disabled={busy !== null}
            />
            <ActionButton
              variant="primary"
              onAction={() => void open('create')}
              disabled={busy !== null}
            >
              {busy === 'create' ? 'Creating…' : 'Create spreadsheet'}
            </ActionButton>
          </form>
        </Card>

        <Card className="flex flex-col items-start gap-3 p-5">
          <h3 className="font-semibold">Use a sheet you already have</h3>
          <p className="flex-1 text-sm text-muted">
            Choose a spreadsheet from your Drive. Ledger only gets access to the one you pick, never
            the rest of your files.
          </p>
          <ActionButton onAction={() => void open('pick')} disabled={busy !== null}>
            {busy === 'pick' ? 'Opening…' : 'Choose from Google Drive'}
          </ActionButton>
        </Card>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
