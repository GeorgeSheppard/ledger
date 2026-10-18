import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { paths } from '../../app/paths';
import { DEFAULT_SPREADSHEET_TITLE } from '../../lib/google/newSpreadsheet';
import { useSession } from '../../state/session';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { useAsyncAction } from './useAsyncAction';

/** After sign-in: choose an existing spreadsheet with the Google Picker, or create a new one. */
export function ConnectPage() {
  const { session, spreadsheets, connect, signOut } = useSession();
  const navigate = useNavigate();
  const [title, setTitle] = useState(DEFAULT_SPREADSHEET_TITLE);
  const { busy, error, run } = useAsyncAction<'pick' | 'create'>();

  useEffect(() => spreadsheets.preload?.(), [spreadsheets]);

  if (session.status === 'signed-out') return <Navigate to={paths.home} replace />;
  const current = session.status === 'connected' ? session.spreadsheet : null;

  const open = (key: 'pick' | 'create') =>
    run(key, async () => {
      const spreadsheet =
        key === 'pick' ? await spreadsheets.pick() : await spreadsheets.create(title);
      if (!spreadsheet) return;
      await connect(spreadsheet);
      navigate(paths.home);
    });

  return (
    <Page
      className="max-w-3xl"
      title={current ? 'Switch spreadsheet' : 'Where should Ledger keep your finances?'}
      description={
        current
          ? 'Pick another Google Sheet from your Drive, or create a new one. Your current spreadsheet is left as it is.'
          : 'Ledger reads and writes one Google Sheet in your Drive.'
      }
      actions={
        <ActionButton shortcut="connect.signOut" variant="ghost" onAction={signOut}>
          Sign out
        </ActionButton>
      }
    >
      {current && (
        <Card className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Current spreadsheet
            </span>
            <strong className="block truncate">{current.title}</strong>
          </span>
          <ActionButton shortcut="connect.back" onAction={() => navigate(paths.home)}>
            Back to dashboard
          </ActionButton>
        </Card>
      )}

      <p className="text-sm text-muted">
        Each tab in the spreadsheet is an account, with the columns{' '}
        <strong className="text-fg">Date, Category, Amount, Note, Total</strong>.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-lg font-semibold">Start fresh</h2>
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
              shortcut="connect.create"
              variant="primary"
              onAction={() => void open('create')}
              disabled={busy !== null}
            >
              {busy === 'create' ? 'Creating…' : 'Create spreadsheet'}
            </ActionButton>
          </form>
        </Card>

        <Card className="flex flex-col items-start gap-3 p-6">
          <h2 className="text-lg font-semibold">Use a sheet you already have</h2>
          <p className="flex-1 text-sm text-muted">
            Choose a spreadsheet from your Drive. Ledger only gets access to the one you pick, never
            the rest of your files.
          </p>
          <ActionButton
            shortcut="connect.pick"
            onAction={() => void open('pick')}
            disabled={busy !== null}
          >
            {busy === 'pick' ? 'Opening…' : 'Choose from Google Drive'}
          </ActionButton>
        </Card>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}
    </Page>
  );
}
