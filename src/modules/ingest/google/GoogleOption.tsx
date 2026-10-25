import { Link } from 'react-router';
import { paths } from '../../../app/paths';
import { useSession } from '../../../state/session';
import { ActionButton } from '../../../ui/ActionButton';
import { useAsyncAction } from '../../../features/connect/useAsyncAction';
import type { IngestOption, IngestSetupProps } from '../types';
import { GoogleSpreadsheetStep } from './GoogleSpreadsheetStep';

/** Step 1 signs in with Google; once signed in, step 2 picks or creates the spreadsheet. */
function GoogleSetup({ onOpened, onUsed }: IngestSetupProps) {
  const { session, signIn, rememberedSpreadsheet } = useSession();
  const { busy, error, run } = useAsyncAction<'sign-in'>();

  if (session.status !== 'signed-out') return <GoogleSpreadsheetStep onOpened={onOpened} />;

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm text-muted">
        Ledger keeps your finances in one Google Sheet in your own Drive. Sign in with Google, then
        choose a spreadsheet you already have or create a new one.
      </p>
      <ActionButton
        variant="primary"
        onAction={() =>
          void run('sign-in', async () => {
            await signIn();
            onUsed();
          })
        }
        disabled={busy !== null}
      >
        {busy
          ? 'Waiting for Google…'
          : rememberedSpreadsheet
            ? `Sign in to open ${rememberedSpreadsheet.title}`
            : 'Agree and sign in with Google'}
      </ActionButton>
      {error && (
        <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">
        By signing in you agree to let Ledger read and change the spreadsheets you choose or create
        with it, and to the <Link to={paths.terms}>terms of service</Link> and{' '}
        <Link to={paths.privacy}>privacy policy</Link>. Nothing else in your Google account is
        shared.
      </p>
    </div>
  );
}

export const googleOption: IngestOption = {
  id: 'google',
  title: 'Google Sheets',
  description: 'Keep your ledger in a Google Sheet in your own Drive, saved as you go.',
  Setup: GoogleSetup,
};
