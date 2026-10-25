import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  browserStore,
  forgetSpreadsheet,
  loadRememberedSpreadsheet,
  rememberSpreadsheet,
} from '../modules/ingest/google/rememberedSpreadsheet';
import type { SpreadsheetSource } from '../modules/ingest/spreadsheetSource';
import { fixtureData } from '../lib/data/fixtures';
import {
  exampleLedger,
  localFileIngest,
  newLocalLedger,
  remoteOf,
  type Connection,
} from '../modules/ingest';
import type { SpreadsheetRef } from '../lib/domain/types';
import {
  createGoogleServices,
  googleConfigFromEnv,
  type GoogleServices,
} from '../modules/ingest/google/googleServices';
import { signInAware } from '../modules/ingest/google/signInAware';
import { GoogleApiError } from '../lib/google/sheetsClient';
import { MemoryRemote, type LedgerRemote } from '../lib/store/remote';
import { discardLocalData } from './ledgerData';

/**
 * Who is signed in and which spreadsheet is connected. The rest of the app reads this through
 * `useSession()` and never touches auth directly.
 *
 * - `signed-out`: show the landing page.
 * - `signed-in`: authenticated with Google but no spreadsheet chosen yet; show the connect page.
 * - `connected`: a spreadsheet is open; `remote` reads and writes it. `LedgerDataProvider` loads it
 *   into a `LedgerStore`, which is what features use. `file` is set when it is a spreadsheet file
 *   from the user's device rather than a Google Sheet; pages treat both the same.
 */
export type Session =
  | { status: 'signed-out' }
  | { status: 'signed-in' }
  | { status: 'connected'; spreadsheet: SpreadsheetRef; remote: LedgerRemote; file?: true };

export interface SessionApi {
  session: Session;
  signIn(): Promise<void>;
  /**
   * Leaves Ledger for good: signs out of Google, forgets the remembered spreadsheet, empties the
   * browser's working copy (unsaved edits are lost, so callers ask first) and returns to the landing
   * page. Works the same for a Google Sheet and for a file.
   */
  exit(): Promise<void>;
  /** Opens a spreadsheet (from the picker or newly created) and moves to `connected`. */
  connect(spreadsheet: SpreadsheetRef): Promise<void>;
  disconnect(): void;
  /** Finds or creates spreadsheets for the connect page. */
  spreadsheets: SpreadsheetSource;
  /** The spreadsheet that signing in will reopen, if the user connected one before. */
  rememberedSpreadsheet: SpreadsheetRef | null;
  /** Opens a `.xlsx` or `.csv` from the user's device instead of a Google Sheet. Rejects with a readable message. */
  openFile(file: File): Promise<void>;
  /** Opens an empty ledger that is kept in a file the user downloads. */
  startBlankFile(): void;
  /** Opens the built-in example ledger, to explore the app without any data of one's own. */
  startExample(): void;
  /** Leaves the open file, back to wherever the user was before opening it. */
  closeFile(): void;
}

/** What each session hook provides itself; `useFileOverlay` adds the file methods on top. */
type BaseSessionApi = Omit<
  SessionApi,
  'openFile' | 'startBlankFile' | 'startExample' | 'closeFile'
>;

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Where data comes from. `memory` (the default under `pnpm dev` only) starts connected to demo data
 * so every page can be built without credentials. `google` (the default in any built app, previews
 * included) signs in with Google and uses the user's own sheet; demo data is then only reachable by
 * choosing "Explore an example".
 */
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? (import.meta.env.DEV ? 'memory' : 'google');

const DEMO_SPREADSHEET: SpreadsheetRef = { id: 'demo', title: 'Demo ledger' };

const demoSpreadsheets: SpreadsheetSource = {
  pick: async () => DEMO_SPREADSHEET,
  create: async (title) => ({ id: DEMO_SPREADSHEET.id, title: title.trim() || 'Ledger' }),
};

/** Dev/demo session backed by `MemoryRemote`. Sign-in and connect succeed immediately. */
function useMemorySession(): BaseSessionApi {
  const [session, setSession] = useState<Session>(() => ({
    status: 'connected',
    spreadsheet: DEMO_SPREADSHEET,
    remote: new MemoryRemote(fixtureData()),
  }));
  return useMemo(
    () => ({
      session,
      signIn: async () => setSession({ status: 'signed-in' }),
      exit: async () => setSession({ status: 'signed-out' }),
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
function useGoogleSession(google: GoogleServices): BaseSessionApi {
  const [connectionStore] = useState(() => browserStore('local'));
  const [remembered, setRemembered] = useState(() => loadRememberedSpreadsheet(connectionStore));

  const [session, setSession] = useState<Session>(() => {
    if (!google.auth.isSignedIn) return { status: 'signed-out' };
    return remembered ? connected(remembered) : { status: 'signed-in' };
  });

  function connected(spreadsheet: SpreadsheetRef): Session {
    const remote = signInAware(google.remote(spreadsheet), () =>
      setSession({ status: 'signed-out' })
    );
    return { status: 'connected', spreadsheet, remote };
  }

  function remember(spreadsheet: SpreadsheetRef | null) {
    if (spreadsheet) rememberSpreadsheet(connectionStore, spreadsheet);
    else forgetSpreadsheet(connectionStore);
    setRemembered(spreadsheet);
  }

  const api: BaseSessionApi = {
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
    async exit() {
      google.auth.signOut();
      remember(null);
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

/**
 * Lets the user work from a file on their device, whichever source is configured. While a file is
 * open it replaces the session; closing it, or connecting to Google, goes back to the base session.
 */
function useFileOverlay(base: BaseSessionApi): SessionApi {
  const [file, setFile] = useState<Extract<Session, { status: 'connected' }> | null>(null);
  const opened = useRef(0);

  const show = (connection: Connection) =>
    setFile({
      status: 'connected',
      spreadsheet: { id: `file:${++opened.current}`, title: connection.title },
      remote: remoteOf(connection),
      file: true,
    });

  return {
    ...base,
    session: file ?? base.session,
    async openFile(chosen) {
      show(await localFileIngest.open(chosen));
    },
    startBlankFile: () => show(newLocalLedger()),
    startExample: () => show(exampleLedger()),
    closeFile: () => setFile(null),
    async exit() {
      await discardLocalData();
      setFile(null);
      await base.exit();
    },
    async connect(spreadsheet) {
      setFile(null);
      await base.connect(spreadsheet);
    },
    disconnect() {
      setFile(null);
      base.disconnect();
    },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DATA_SOURCE === 'memory') return <MemorySessionProvider>{children}</MemorySessionProvider>;
  if (DATA_SOURCE === 'google') return <GoogleSessionProvider>{children}</GoogleSessionProvider>;
  throw new Error(`Unsupported VITE_DATA_SOURCE: ${DATA_SOURCE}`);
}

function MemorySessionProvider({ children }: { children: ReactNode }) {
  const api = useFileOverlay(useMemorySession());
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
  const api = useFileOverlay(useGoogleSession(google));
  // Load Google's sign-in library early so the popup opens straight from the click.
  useEffect(() => google.auth.preload(), [google]);
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession must be used inside <SessionProvider>');
  return api;
}
