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
function Seed({ dashboard, children }: { dashboard?: DashboardConfig; children: ReactNode }) {
  const repository = useRepository();
  const [ready, setReady] = useState(!dashboard);
  useEffect(() => {
    if (!dashboard) return;
    repository
      .saveDashboardConfig(serializeDashboard(dashboard) as unknown as JsonValue)
      .then(() => setReady(true));
  }, [repository, dashboard]);
  return ready ? children : null;
}

interface ConnectedProps {
  route?: string;
  /** Replaces the default dashboard layout. */
  dashboard?: DashboardConfig;
  /** Wraps `children` in the sidebar and header, as pages are in the app. */
  shell?: boolean;
  children: ReactNode;
}

/** A connected demo spreadsheet, with the data hooks available. Use for pages and dialogs. */
export function Connected({ route = '/', dashboard, shell = false, children }: ConnectedProps) {
  return (
    <AppProviders route={route}>
      <LedgerDataProvider>
        <Seed dashboard={dashboard}>{shell ? <AppShell>{children}</AppShell> : children}</Seed>
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
