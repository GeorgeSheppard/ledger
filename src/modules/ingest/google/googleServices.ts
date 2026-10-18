import type { KeyValueStore } from './rememberedSpreadsheet';
import type { SpreadsheetSource } from '../spreadsheetSource';
import type { SpreadsheetRef } from '../../../lib/domain/types';
import { GoogleAuth } from './auth';
import { loadIdentityServices, loadPicker } from './googleGlobals';
import { createLedgerSpreadsheet, openSpreadsheet } from './newSpreadsheet';
import { pickSpreadsheet, projectNumberFromClientId } from './picker';
import { HttpSheetsClient } from '../../../lib/google/sheetsClient';
import type { LedgerRemote } from '../../../lib/store/remote';
import { remoteOf } from '../types';
import { googleConnection } from './index';

export interface GoogleConfig {
  clientId: string;
  apiKey: string;
}

/** Everything the app needs from Google, wired together. Built once by the session provider. */
export interface GoogleServices {
  auth: GoogleAuth;
  spreadsheets: SpreadsheetSource;
  /** Checks the spreadsheet is still reachable and returns it with its current title. */
  open(id: string): Promise<SpreadsheetRef>;
  /** Reads and writes one spreadsheet for `LedgerStore`. */
  remote(spreadsheet: SpreadsheetRef): LedgerRemote;
}

/** Reads the Google settings from the build environment, with a clear error when they are missing. */
export function googleConfigFromEnv(env: {
  VITE_GOOGLE_CLIENT_ID?: string;
  VITE_GOOGLE_API_KEY?: string;
}): GoogleConfig {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const apiKey = env.VITE_GOOGLE_API_KEY?.trim();
  if (!clientId || !apiKey)
    throw new Error(
      'VITE_DATA_SOURCE=google needs VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY. See docs/GOOGLE_SETUP.md.'
    );
  return { clientId, apiKey };
}

export function createGoogleServices(
  config: GoogleConfig,
  tokenStore: KeyValueStore
): GoogleServices {
  const auth = new GoogleAuth({
    clientId: config.clientId,
    loadOauth2: loadIdentityServices,
    store: tokenStore,
  });
  const client = new HttpSheetsClient(auth);
  const appId = projectNumberFromClientId(config.clientId);
  return {
    auth,
    spreadsheets: {
      pick: async () =>
        pickSpreadsheet({
          accessToken: await auth.getAccessToken(),
          apiKey: config.apiKey,
          appId,
          loadPicker,
        }),
      create: (title) => createLedgerSpreadsheet(client, title),
      preload: () => {
        loadPicker().catch(() => {
          // Reported when the user opens the picker.
        });
      },
    },
    open: (id) => openSpreadsheet(client, id),
    remote: (spreadsheet) => remoteOf(googleConnection(client, spreadsheet)),
  };
}
