import { loadScript } from './scriptLoader';

/**
 * Minimal types for the two Google browser libraries Ledger uses, and loaders for them.
 * - Google Identity Services (token model): https://developers.google.com/identity/oauth2/web/guides/use-token-model
 * - Google Picker: https://developers.google.com/workspace/drive/picker/guides/overview
 */

export interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken(overrides?: { prompt?: '' | 'none' | 'consent' | 'select_account' }): void;
}

export interface GisOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

export interface PickerResponse {
  action: string;
  docs?: { id: string; name?: string }[];
}

interface PickerView {
  setMimeTypes(mimeTypes: string): PickerView;
  setMode(mode: unknown): PickerView;
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

export interface PickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId?: unknown) => PickerView;
  ViewId: { SPREADSHEETS: unknown };
  DocsViewMode: { LIST: unknown };
  Action: { PICKED: string; CANCEL: string };
}

interface GoogleWindow {
  google?: { accounts?: { oauth2?: GisOauth2 }; picker?: PickerNamespace };
  gapi?: { load(api: string, options: { callback: () => void; onerror: () => void }): void };
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';

function googleWindow(): GoogleWindow {
  return window as unknown as GoogleWindow;
}

export async function loadIdentityServices(): Promise<GisOauth2> {
  await loadScript(GIS_SRC);
  const oauth2 = googleWindow().google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google sign-in did not load');
  return oauth2;
}

let pickerPromise: Promise<PickerNamespace> | null = null;

export function loadPicker(): Promise<PickerNamespace> {
  pickerPromise ??= loadScript(GAPI_SRC)
    .then(
      () =>
        new Promise<PickerNamespace>((resolve, reject) => {
          const gapi = googleWindow().gapi;
          if (!gapi) return reject(new Error('Google APIs did not load'));
          gapi.load('picker', {
            callback: () => {
              const picker = googleWindow().google?.picker;
              if (picker) resolve(picker);
              else reject(new Error('Google Picker did not load'));
            },
            onerror: () => reject(new Error('Google Picker did not load')),
          });
        })
    )
    .catch((error: unknown) => {
      pickerPromise = null;
      throw error;
    });
  return pickerPromise;
}
