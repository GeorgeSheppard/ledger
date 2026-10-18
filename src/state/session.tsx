import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  browserStore,
  forgetSpreadsheet,
  loadRememberedSpreadsheet,
  rememberSpreadsheet,
} from '../lib/connection/rememberedSpreadsheet';
import type { SpreadsheetSource } from '../lib/connection/spreadsheetSource';
import { fixtureData } from '../lib/data/fixtures';
import type { SpreadsheetRef } from '../lib/domain/types';
import {
  createGoogleServices,
  googleConfigFromEnv,
  type GoogleServices,
} from '../lib/google/googleServices';
import { signInAware } from '../lib/google/signInAware';
import { GoogleApiError } from '../lib/google/sheetsClient';
import { MemoryRemote, type LedgerRemote } from '../lib/store/remote';

/**
 * Who is signed in and which spreadsheet is connected. The rest of the app reads this through
 * `useSession()` and never touches auth directly.
 *
 * - `signed-out`: show the landing page.
 * - `signed-in`: authenticated with Google but no spreadsheet chosen yet; show the connect page.
 * - `connected`: a spreadsheet is open; `remote` reads and writes it. `LedgerDataProvider` loads it
 *   into a `LedgerStore`, which is what features use.
 */
export type Session =
  | { status: 'signed-out' }
  | { status: 'signed-in' }
  | { status: 'connected'; spreadsheet: SpreadsheetRef; remote: LedgerRemote };

export interface SessionApi {
  session: Session;
  signIn(): Promise<void>;
  signOut(): void;
  /** Opens a spreadsheet (from the picker or newly created) and moves to `connected`. */
  connect(spreadsheet: SpreadsheetRef): Promise<void>;
  disconnect(): void;
  /** Finds or creates spreadsheets for the connect page. */
  spreadsheets: SpreadsheetSource;
  /** The spreadsheet that signing in will reopen, if the user connected one before. */
  rememberedSpreadsheet: SpreadsheetRef | null;
}

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Where data comes from. `memory` (the default) starts connected to demo data so every page can be
 * built without credentials. `google` signs in with Google and uses the user's own sheet.
 */
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'memory';

const DEMO_SPREADSHEET: SpreadsheetRef = { id: 'demo', title: 'Demo ledger' };

const demoSpreadsheets: SpreadsheetSource = {
  pick: async () => DEMO_SPREADSHEET,
  create: async (title) => ({ id: DEMO_SPREADSHEET.id, title: title.trim() || 'Ledger' }),
};

/** Dev/demo session backed by `MemoryRemote`. Sign-in and connect succeed immediately. */
function useMemorySession(): SessionApi {
  const [session, setSession] = useState<Session>(() => ({
    status: 'connected',
    spreadsheet: DEMO_SPREADSHEET,
    remote: new MemoryRemote(fixtureData()),
  }));
  return useMemo(
    () => ({
      session,
      signIn: async () => setSession({ status: 'signed-in' }),
      signOut: () => setSession({ status: 'signed-out' }),
      connect: async (spreadsheet) =>
        setSession({
          status: 'connected',
          spreadsheet,
          remote: new MemoryRemote(fixtureData()),
        }),
      disconnect: () => setSession({ status: 'signed-in' }),
      spreadsheets: demoSpreadsheets,
      rememberedSpreadsheet: null,
    }),
    [session]
  );
}

/**
 * Session backed by Google sign-in and the user's spreadsheet. The access token lives in
 * `sessionStorage` (this tab only); the connected spreadsheet's id is remembered in `localStorage`
 * so signing in again goes straight back to it.
 */
function useGoogleSession(google: GoogleServices): SessionApi {
  const [connectionStore] = useState(() => browserStore('local'));
  const [remembered, setRemembered] = useState(() => loadRememberedSpreadsheet(connectionStore));

  const [session, setSession] = useState<Session>(() => {
    if (!google.auth.isSignedIn) return { status: 'signed-out' };
    return remembered ? connected(remembered) : { status: 'signed-in' };
  });

  function connected(spreadsheet: SpreadsheetRef): Session {
    const remote = signInAware(google.remote(spreadsheet.id), () =>
      setSession({ status: 'signed-out' })
    );
    return { status: 'connected', spreadsheet, remote };
  }

  function remember(spreadsheet: SpreadsheetRef | null) {
    if (spreadsheet) rememberSpreadsheet(connectionStore, spreadsheet);
    else forgetSpreadsheet(connectionStore);
    setRemembered(spreadsheet);
  }

  const api: SessionApi = {
    session,
    spreadsheets: google.spreadsheets,
    rememberedSpreadsheet: remembered,
    async signIn() {
      await google.auth.signIn();
      if (!remembered) return setSession({ status: 'signed-in' });
      try {
        // Refreshes the title and confirms this Google account can still open it.
        const spreadsheet = await google.open(remembered.id);
        remember(spreadsheet);
        setSession(connected(spreadsheet));
      } catch (error) {
        if (error instanceof GoogleApiError && error.isNotAccessible) remember(null);
        setSession({ status: 'signed-in' });
      }
    },
    signOut() {
      google.auth.signOut();
      setSession({ status: 'signed-out' });
    },
    async connect(spreadsheet) {
      remember(spreadsheet);
      setSession(connected(spreadsheet));
    },
    disconnect() {
      remember(null);
      setSession({ status: 'signed-in' });
    },
  };
  return api;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DATA_SOURCE === 'memory') return <MemorySessionProvider>{children}</MemorySessionProvider>;
  if (DATA_SOURCE === 'google') return <GoogleSessionProvider>{children}</GoogleSessionProvider>;
  throw new Error(`Unsupported VITE_DATA_SOURCE: ${DATA_SOURCE}`);
}

function MemorySessionProvider({ children }: { children: ReactNode }) {
  const api = useMemorySession();
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

function GoogleSessionProvider({ children }: { children: ReactNode }) {
  const [google] = useState(() => {
    try {
      return createGoogleServices(googleConfigFromEnv(import.meta.env), browserStore('session'));
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  });
  if (google instanceof Error)
    return (
      <div className="placeholder">
        <h1>Ledger is not configured</h1>
        <p>{google.message}</p>
      </div>
    );
  return <GoogleSessionContext google={google}>{children}</GoogleSessionContext>;
}

function GoogleSessionContext({
  google,
  children,
}: {
  google: GoogleServices;
  children: ReactNode;
}) {
  const api = useGoogleSession(google);
  // Load Google's sign-in library early so the popup opens straight from the click.
  useEffect(() => google.auth.preload(), [google]);
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession must be used inside <SessionProvider>');
  return api;
}
