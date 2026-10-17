import type { SpreadsheetRef } from '../domain/types';
import type { PickerNamespace } from './googleGlobals';

export interface PickerOptions {
  accessToken: string;
  apiKey: string;
  /** The Cloud project number. With `drive.file`, this is what grants access to the picked file. */
  appId: string;
  loadPicker: () => Promise<PickerNamespace>;
}

/** The project number is the numeric prefix of an OAuth client id (`123-abc.apps.googleusercontent.com`). */
export function projectNumberFromClientId(clientId: string): string {
  const match = /^(\d+)-/.exec(clientId);
  if (!match?.[1]) throw new Error('VITE_GOOGLE_CLIENT_ID does not look like an OAuth client id');
  return match[1];
}

/** Opens the Google Picker on the user's spreadsheets. Resolves `null` if they cancel. */
export async function pickSpreadsheet(options: PickerOptions): Promise<SpreadsheetRef | null> {
  const picker = await options.loadPicker();
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setMimeTypes('application/vnd.google-apps.spreadsheet')
      .setMode(picker.DocsViewMode.LIST);
    new picker.PickerBuilder()
      .addView(view)
      .setTitle('Choose your Ledger spreadsheet')
      .setOAuthToken(options.accessToken)
      .setDeveloperKey(options.apiKey)
      .setAppId(options.appId)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          const doc = response.docs?.[0];
          resolve(doc ? { id: doc.id, title: doc.name ?? 'Untitled spreadsheet' } : null);
        } else if (response.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
}
