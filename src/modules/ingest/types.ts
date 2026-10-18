import type { LedgerRemote, RemoteState } from '../../lib/store/remote';
import type { Saver } from '../save';

/**
 * A ledger that has been opened: where to read it from and, paired with it, how to push changes
 * back to where it came from. Everything after this point (the IndexedDB-backed store, the pages)
 * works from a `Connection` and cannot tell a Google Sheet from a file on disk.
 */
export interface Connection {
  /** Shown as the spreadsheet name. */
  title: string;
  /** Reads the whole ledger. */
  load(): Promise<RemoteState>;
  saver: Saver;
}

/** One way of getting a ledger into the app. `Input` is what the user supplies to open one. */
export interface Ingest<Input> {
  readonly id: string;
  readonly label: string;
  open(input: Input): Promise<Connection>;
}

/** The store's view of a connection: its reader and its saver as one object. */
export function remoteOf({ load, saver }: Connection): LedgerRemote {
  const download = saver.download?.bind(saver);
  return {
    load,
    save: (base, next) => saver.save(base, next),
    ...(download && { download }),
  };
}
