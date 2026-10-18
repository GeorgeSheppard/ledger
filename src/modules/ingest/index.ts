import { googleOption } from './google/GoogleOption';
import { blankOption, uploadOption } from './local-file/FileOptions';
import type { IngestOption } from './types';

export type { Connection, Ingest, IngestOption, IngestSetupProps } from './types';
export { remoteOf } from './types';
export { googleConnection, googleIngest } from './google';
export { GoogleSpreadsheetStep } from './google/GoogleSpreadsheetStep';
export { localFileIngest, newLocalLedger } from './local-file';

/** Every way of getting a ledger in that the Get started dialog offers. Add a new one here and nowhere else. */
export const INGEST_OPTIONS: readonly IngestOption[] = [googleOption, uploadOption, blankOption];
