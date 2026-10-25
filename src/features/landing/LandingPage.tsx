import { useState } from 'react';
import { ActionButton } from '../../ui/ActionButton';
import { Card } from '../../ui/Card';
import { DonateLink } from '../../ui/DonateLink';
import type { IngestOption } from '../../modules/ingest';
import { GetStartedDialog } from '../connect/GetStartedDialog';
import { IngestOptionList } from '../connect/IngestOptionList';
import { useLastUsedIngest } from '../connect/useLastUsedIngest';
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
    title: 'Choose where your data lives',
    body: 'Connect a Google Sheet, upload a spreadsheet file, or start with a blank ledger.',
  },
  {
    title: 'Bring in your data',
    body: 'Use a spreadsheet you already have, or start a fresh one.',
  },
  {
    title: 'Track and explore',
    body: 'Each tab is an account. Add transactions and watch the charts.',
  },
];

/**
 * The public homepage: what Ledger is and how your data is handled. "Get started" opens the dialog
 * that offers every way of bringing data in. A marketing layout rather than `<Page>`, but on the
 * same width and padding.
 */
export function LandingPage() {
  const [starting, setStarting] = useState(false);
  const [initial, setInitial] = useState<IngestOption | null>(null);
  const { lastUsed } = useLastUsedIngest();

  const cta = (
    <ActionButton
      variant="primary"
      onAction={() => {
        setInitial(null);
        setStarting(true);
      }}
      className="self-start px-4 py-2.5 text-base"
    >
      Get started
    </ActionButton>
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
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide text-muted uppercase">
              Choose how to start
            </h2>
            <IngestOptionList
              lastUsed={lastUsed}
              onChoose={(option) => {
                setInitial(option);
                setStarting(true);
              }}
            />
          </div>
        </div>
        <SheetPreview />
      </section>

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
        <h2 className="text-2xl font-semibold tracking-tight">Your data stays on your device</h2>
        <ul className="flex max-w-3xl list-disc flex-col gap-3 pl-5 text-muted">
          <li>
            Everything Ledger does with your finances, from reading your spreadsheet to importing
            statements and drawing charts, happens in your browser. Your data is never processed on
            any other computer, and Ledger has no server that could receive it.
          </li>
          <li>
            Open a spreadsheet file from your device and it never leaves it. Google is optional: if
            you choose to sync with a Google Sheet, Ledger can only open the sheets you pick, and
            your data travels straight between your browser and your own Drive.
          </li>
          <li>
            Press Exit to clear Ledger&rsquo;s local copy from your browser. If you used Google, you
            can also remove Ledger&rsquo;s access from your Google Account&rsquo;s{' '}
            <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
              third-party connections
            </a>{' '}
            page. Your spreadsheet stays where it is.
          </li>
        </ul>
        {cta}
      </section>

      <footer className="flex flex-col gap-3 border-t border-line pt-6">
        <DonateLink />
        <LegalLinks />
      </footer>
      {starting && <GetStartedDialog initial={initial} onClose={() => setStarting(false)} />}
    </div>
  );
}
