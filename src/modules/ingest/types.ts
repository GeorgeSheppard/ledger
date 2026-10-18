import type { ComponentType } from 'react';
import type { LedgerRemote, LoadProgress, RemoteState } from '../../lib/store/remote';
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
  load(onProgress?: (progress: LoadProgress) => void): Promise<RemoteState>;
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

/** What an option's walkthrough is given. */
export interface IngestSetupProps {
  /** Call once the ledger is open, so the dialog or page can step aside. */
  onOpened(): void;
}

/**
 * One choice in the "Get started" dialog: a way of bringing a ledger in, and the steps that walk
 * the user through it. Adding an ingest module means adding its option to `INGEST_OPTIONS`.
 */
export interface IngestOption {
  readonly id: string;
  readonly title: string;
  /** One or two plain sentences shown on the choice card. */
  readonly description: string;
  readonly Setup: ComponentType<IngestSetupProps>;
}
