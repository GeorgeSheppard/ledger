/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `memory` (demo data, default) or `google` (the connected Google Sheet). */
  readonly VITE_DATA_SOURCE?: 'memory' | 'google';
  /** OAuth client id from Google Cloud Console. Needed when `VITE_DATA_SOURCE=google`. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Browser API key for the Google Picker. Needed when `VITE_DATA_SOURCE=google`. */
  readonly VITE_GOOGLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
