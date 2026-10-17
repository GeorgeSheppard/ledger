import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { fixtureData } from '../lib/data/fixtures';
import { MemoryRepository } from '../lib/data/memoryRepository';
import type { LedgerRepository } from '../lib/data/repository';
import type { SpreadsheetRef } from '../lib/domain/types';

/**
 * Who is signed in and which spreadsheet is connected. The rest of the app reads this through
 * `useSession()` and never touches auth directly.
 *
 * - `signed-out`: show the landing page.
 * - `signed-in`: authenticated with Google but no spreadsheet chosen yet; show the connect page.
 * - `connected`: a spreadsheet is open and `repository` reads and writes it.
 */
export type Session =
  | { status: 'signed-out' }
  | { status: 'signed-in' }
  | { status: 'connected'; spreadsheet: SpreadsheetRef; repository: LedgerRepository };

export interface SessionApi {
  session: Session;
  signIn(): Promise<void>;
  signOut(): void;
  /** Opens a spreadsheet (from the picker or newly created) and moves to `connected`. */
  connect(spreadsheet: SpreadsheetRef): Promise<void>;
  disconnect(): void;
}

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Where data comes from. `memory` (the default until Google sign-in lands) starts connected to
 * demo data so every page can be built without credentials. Step 1 adds the `google` source.
 */
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE ?? 'memory';

const DEMO_SPREADSHEET: SpreadsheetRef = { id: 'demo', title: 'Demo ledger' };

/** Dev/demo session backed by `MemoryRepository`. Sign-in and connect succeed immediately. */
function useMemorySession(): SessionApi {
  const [session, setSession] = useState<Session>(() => ({
    status: 'connected',
    spreadsheet: DEMO_SPREADSHEET,
    repository: new MemoryRepository(fixtureData()),
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
          repository: new MemoryRepository(fixtureData()),
        }),
      disconnect: () => setSession({ status: 'signed-in' }),
    }),
    [session]
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (DATA_SOURCE !== 'memory') throw new Error(`Unsupported VITE_DATA_SOURCE: ${DATA_SOURCE}`);
  return <MemorySessionProvider>{children}</MemorySessionProvider>;
}

function MemorySessionProvider({ children }: { children: ReactNode }) {
  const api = useMemorySession();
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession must be used inside <SessionProvider>');
  return api;
}
