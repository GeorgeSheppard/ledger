import { useEffect, useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { serializeDashboard } from '../lib/dashboard/serialize';
import type { DashboardConfig } from '../lib/dashboard/config';
import type { JsonValue } from '../lib/store/ledgerData';
import { AppShell } from '../app/AppShell';
import { LedgerDataProvider, useRepository } from '../state/ledgerData';
import { SessionProvider, useSession } from '../state/session';
import { ShortcutProvider } from '../state/shortcuts';

/**
 * Providers for stories. They are the app's real ones: `SessionProvider` runs in demo mode (a
 * `MemoryRemote` filled with `fixtureData()`), and `LedgerDataProvider` loads it into a real
 * `LedgerStore`. Components therefore read and write data exactly as they do in the app.
 */

/** Router, session and shortcuts, for stories that need no spreadsheet (landing, connect). */
export function AppProviders({ route = '/', children }: { route?: string; children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <SessionProvider>
        <ShortcutProvider>{children}</ShortcutProvider>
      </SessionProvider>
    </MemoryRouter>
  );
}

/** Seeds the store before showing `children`, so a story starts with the data it describes. */
function Seed({
  dashboard,
  creditCard,
  noPaychecks,
  children,
}: {
  dashboard?: DashboardConfig;
  creditCard?: boolean;
  noPaychecks?: boolean;
  children: ReactNode;
}) {
  const repository = useRepository();
  const [ready, setReady] = useState(!dashboard && !creditCard && !noPaychecks);
  useEffect(() => {
    if (!dashboard && !creditCard && !noPaychecks) return;
    (async () => {
      if (noPaychecks) await repository.savePaychecks(null);
      if (dashboard)
        await repository.saveDashboardConfig(serializeDashboard(dashboard) as unknown as JsonValue);
      if (creditCard) await addCreditCard(repository);
      setReady(true);
    })();
  }, [repository, dashboard, creditCard, noPaychecks]);
  return ready ? children : null;
}

/** A credit card tab as a card statement reads: purchases positive, the payment negative. */
async function addCreditCard(repository: ReturnType<typeof useRepository>) {
  const card = await repository.createAccount(CREDIT_CARD_NAME);
  await repository.addTransactions(card.id, [
    { date: '2026-08-04', category: 'Groceries', amount: 86.4, note: 'Supermarket' },
    { date: '2026-08-19', category: 'Eating out', amount: 42.5, note: 'Dinner' },
    { date: '2026-09-02', category: '', amount: -120, note: 'Payment, thank you' },
    { date: '2026-09-09', category: 'Groceries', amount: 64.2, note: 'Supermarket' },
    { date: '2026-09-21', category: 'Travel', amount: 210, note: 'Train tickets' },
  ]);
  await repository.setAccountInverted(card.id, true);
}

export const CREDIT_CARD_NAME = 'Credit card';

interface ConnectedProps {
  route?: string;
  /** Replaces the default dashboard layout. */
  dashboard?: DashboardConfig;
  /** Adds an inverted "Credit card" account (purchases positive) to the demo spreadsheet. */
  creditCard?: boolean;
  /** Starts with no paychecks entered. */
  noPaychecks?: boolean;
  /** Wraps `children` in the sidebar and header, as pages are in the app. */
  shell?: boolean;
  children: ReactNode;
}

/** A connected demo spreadsheet, with the data hooks available. Use for pages and dialogs. */
export function Connected({
  route = '/',
  dashboard,
  creditCard,
  noPaychecks,
  shell = false,
  children,
}: ConnectedProps) {
  return (
    <AppProviders route={route}>
      <LedgerDataProvider>
        <Seed dashboard={dashboard} creditCard={creditCard} noPaychecks={noPaychecks}>
          {shell ? <AppShell>{children}</AppShell> : children}
        </Seed>
      </LedgerDataProvider>
    </AppProviders>
  );
}

/** Starts a story signed in but not connected, which is when the connect page is shown. */
export function SignedIn({
  route = '/connect',
  children,
}: {
  route?: string;
  children: ReactNode;
}) {
  return (
    <AppProviders route={route}>
      <SignInOnce>{children}</SignInOnce>
    </AppProviders>
  );
}

function SignInOnce({ children }: { children: ReactNode }) {
  const { session, disconnect } = useSession();
  useEffect(() => disconnect(), [disconnect]);
  return session.status === 'signed-in' ? children : null;
}
