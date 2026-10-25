import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ExitButton } from '../../app/ExitButton';
import { paths } from '../../app/paths';
import { GoogleSpreadsheetStep } from '../../modules/ingest';
import { useSession } from '../../state/session';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { Page } from '../../ui/Page';
import { GetStartedDialog } from './GetStartedDialog';
import { useLastUsedIngest } from './useLastUsedIngest';

/** After sign-in, or when switching: choose a Google Sheet, or one of the other ways to start. */
export function ConnectPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [others, setOthers] = useState(false);
  const { markUsed } = useLastUsedIngest();

  if (session.status === 'signed-out') return <Navigate to={paths.home} replace />;
  const current = session.status === 'connected' ? session.spreadsheet : null;

  return (
    <Page
      className="max-w-3xl"
      title={current ? 'Switch spreadsheet' : 'Where should Ledger keep your finances?'}
      description={
        current
          ? 'Pick another Google Sheet from your Drive, or create a new one. Your current spreadsheet is left as it is.'
          : 'Ledger reads and writes one Google Sheet in your Drive.'
      }
      actions={<ExitButton variant="ghost" />}
    >
      {current && (
        <Card className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Current spreadsheet
            </span>
            <strong className="block truncate">{current.title}</strong>
          </span>
          <ActionButton onAction={() => navigate(paths.home)}>Back to dashboard</ActionButton>
        </Card>
      )}

      <GoogleSpreadsheetStep
        onOpened={() => {
          markUsed('google');
          navigate(paths.home);
        }}
      />

      <p className="text-sm text-muted">
        Not using Google?{' '}
        <button
          type="button"
          className="cursor-pointer text-accent underline"
          onClick={() => setOthers(true)}
        >
          See the other ways to start
        </button>
        .
      </p>
      {others && <GetStartedDialog onClose={() => setOthers(false)} />}
    </Page>
  );
}
