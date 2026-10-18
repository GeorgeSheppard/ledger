import type { KeyValueStore } from './rememberedSpreadsheet';
import type { GisOauth2, TokenResponse } from './googleGlobals';
import type { AccessTokenProvider } from '../../../lib/google/sheetsClient';
import {
  clearToken,
  isTokenUsable,
  loadToken,
  saveToken,
  tokenFromResponse,
  type StoredToken,
} from './token';

/**
 * `drive.file` is the narrowest scope that works: the app can only see and change spreadsheets the
 * user picks in the Google Picker or creates through Ledger. It cannot list or read anything else
 * in their Drive.
 */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Thrown when there is no usable token and one cannot be fetched without the user. */
export class SignInRequiredError extends Error {
  constructor(message = 'Your Google session has ended. Sign in again to continue.') {
    super(message);
    this.name = 'SignInRequiredError';
  }
}

export interface GoogleAuthOptions {
  clientId: string;
  loadOauth2: () => Promise<GisOauth2>;
  /** Where the token is kept between reloads (`sessionStorage` in the browser). */
  store: KeyValueStore;
  now?: () => number;
}

/**
 * Google sign-in with the Identity Services token model. There is no backend and no refresh
 * token: when the access token expires, `getAccessToken` asks Google for a new one, which works
 * without a prompt while the user's Google session and consent are still valid.
 */
export class GoogleAuth implements AccessTokenProvider {
  private readonly options: GoogleAuthOptions;
  private token: StoredToken | null;
  private pending: Promise<StoredToken> | null = null;

  constructor(options: GoogleAuthOptions) {
    this.options = options;
    this.token = loadToken(options.store);
  }

  /** True if a token from an earlier sign-in in this tab is still valid. */
  get isSignedIn(): boolean {
    return isTokenUsable(this.token, this.now());
  }

  /** Loads the Google library ahead of time, so the sign-in popup opens straight from the click. */
  preload(): void {
    this.options.loadOauth2().catch(() => {
      // Reported when the user actually tries to sign in.
    });
  }

  /** Interactive sign-in. Call from a click handler so the browser allows the popup. */
  async signIn(): Promise<void> {
    await this.requestToken('');
  }

  async getAccessToken({ forceRefresh = false } = {}): Promise<string> {
    if (!forceRefresh && isTokenUsable(this.token, this.now())) return this.token.accessToken;
    try {
      return (await this.requestToken('')).accessToken;
    } catch (error) {
      throw error instanceof SignInRequiredError ? error : new SignInRequiredError();
    }
  }

  signOut(): void {
    const token = this.token;
    this.token = null;
    clearToken(this.options.store);
    if (token)
      this.options
        .loadOauth2()
        .then((oauth2) => oauth2.revoke(token.accessToken))
        .catch(() => {
          // The token expires on its own within the hour.
        });
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private requestToken(prompt: '' | 'consent'): Promise<StoredToken> {
    // Concurrent requests (several queries loading at once) share one popup.
    this.pending ??= this.fetchToken(prompt).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async fetchToken(prompt: '' | 'consent'): Promise<StoredToken> {
    const oauth2 = await this.options.loadOauth2();
    const response = await new Promise<TokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.options.clientId,
        scope: GOOGLE_SCOPE,
        callback: resolve,
        error_callback: (error) => reject(new SignInRequiredError(signInErrorMessage(error.type))),
      });
      client.requestAccessToken({ prompt });
    });
    if (response.error) throw new SignInRequiredError(response.error_description ?? response.error);
    if (!oauth2.hasGrantedAllScopes(response, GOOGLE_SCOPE))
      throw new SignInRequiredError(
        'Ledger needs permission to see the spreadsheets you choose. Sign in again and allow it.'
      );
    const token = tokenFromResponse(response, this.now());
    if (!token) throw new SignInRequiredError('Google did not return an access token.');
    this.token = token;
    saveToken(this.options.store, token);
    return token;
  }
}

function signInErrorMessage(type: string): string {
  switch (type) {
    case 'popup_closed':
      return 'The Google sign-in window was closed before finishing.';
    case 'popup_failed_to_open':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
    default:
      return 'Google sign-in did not complete. Please try again.';
  }
}
