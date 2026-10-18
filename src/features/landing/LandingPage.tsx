import { Link } from 'react-router';
import { paths } from '../../app/paths';
import { useSession } from '../../state/session';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { useAsyncAction } from '../connect/useAsyncAction';
import { LocalFileCard } from '../connect/LocalFileCard';
import { LegalLinks } from '../legal/LegalPage';
import { SheetPreview } from './SheetPreview';

const FEATURES = [
  {
    title: 'Your data stays yours',
    body: 'Everything lives in a Google Sheet in your own Drive. There is no Ledger server or database, and you can open, export or delete the sheet whenever you like.',
  },
  {
    title: 'Easy to keep up to date',
    body: 'Add and edit transactions inline, import a CSV from your bank without creating duplicates, and do it all from the keyboard if you prefer.',
  },
  {
    title: 'See where it all goes',
    body: 'Net worth over time, spending by category and month-to-month changes, without building a single formula or pivot table.',
  },
];

const STEPS = [
  {
    title: 'Sign in with Google',
    body: 'Ledger asks only for access to the files you use with it.',
  },
  {
    title: 'Pick or create a sheet',
    body: 'Use a spreadsheet you already have, or start a fresh one.',
  },
  {
    title: 'Track and explore',
    body: 'Each tab is an account. Add transactions and watch the charts.',
  },
];

/**
 * The public homepage: what Ledger is, how your data is handled, and the sign-in button. A
 * marketing layout rather than `<Page>`, but on the same width and padding.
 */
export function LandingPage() {
  const { signIn, rememberedSpreadsheet } = useSession();
  const { busy, error, run } = useAsyncAction<'sign-in'>();

  const cta = (
    <div className="flex flex-col items-start gap-3">
      <ActionButton
        shortcut="landing.signIn"
        variant="primary"
        onAction={() => void run('sign-in', signIn)}
        disabled={busy !== null}
        className="px-4 py-2.5 text-base"
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
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 p-6 md:p-8">
      <header className="text-lg font-bold">Ledger</header>

      <section className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Your money, in a spreadsheet you own.
          </h1>
          <p className="text-lg text-muted">
            Ledger is a friendly way to keep your finances up to date and see where your money goes,
            without being an Excel wizard. All of your data is stored in your own Google Sheet, or
            in a spreadsheet file on your device, so you stay in control of it.
          </p>
          {cta}
          <p className="max-w-md text-sm text-muted">
            By signing in you agree to let Ledger read and change the spreadsheets you choose or
            create with it, and to the <Link to={paths.terms}>terms of service</Link> and{' '}
            <Link to={paths.privacy}>privacy policy</Link>. Nothing else in your Google account is
            shared.
          </p>
        </div>
        <SheetPreview />
      </section>

      <LocalFileCard scope="landing" className="max-w-3xl" />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Why Ledger">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="p-6">
            <h2 className="mb-2 text-lg font-semibold">{feature.title}</h2>
            <p className="text-sm text-muted">{feature.body}</p>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid size-7 flex-none place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">What Ledger can see</h2>
        <ul className="flex max-w-3xl list-disc flex-col gap-3 pl-5 text-muted">
          <li>
            Only the spreadsheets you pick in Google&rsquo;s file chooser or create through Ledger.
            It cannot browse or read anything else in your Drive.
          </li>
          <li>
            Ledger runs entirely in your browser. Your sign-in lasts for this browser tab, and your
            financial data goes straight between your browser and Google.
          </li>
          <li>
            You can remove Ledger&rsquo;s access at any time from your Google Account&rsquo;s{' '}
            <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
              third-party connections
            </a>{' '}
            page. Your spreadsheet stays where it is.
          </li>
        </ul>
        {cta}
      </section>

      <footer className="border-t border-line pt-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
