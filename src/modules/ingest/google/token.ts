import type { KeyValueStore } from './rememberedSpreadsheet';

/**
 * The OAuth access token is kept in `sessionStorage` so a page reload in the same tab stays signed
 * in. It is short-lived (about an hour), scoped to `drive.file`, and gone when the tab closes.
 */

export interface StoredToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

const KEY = 'ledger.googleToken';
/** Treat tokens as expired a little early so a request never starts with a dying token. */
export const EXPIRY_MARGIN_MS = 60_000;

export function isTokenUsable(token: StoredToken | null, now: number): token is StoredToken {
  return token !== null && token.expiresAt - EXPIRY_MARGIN_MS > now;
}

export function tokenFromResponse(
  response: { access_token?: string; expires_in?: number | string },
  now: number
): StoredToken | null {
  const seconds = Number(response.expires_in);
  if (!response.access_token || !Number.isFinite(seconds) || seconds <= 0) return null;
  return { accessToken: response.access_token, expiresAt: now + seconds * 1000 };
}

export function loadToken(store: KeyValueStore): StoredToken | null {
  try {
    const value: unknown = JSON.parse(store.getItem(KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { accessToken, expiresAt } = value as Record<string, unknown>;
    if (typeof accessToken !== 'string' || typeof expiresAt !== 'number') return null;
    return { accessToken, expiresAt };
  } catch {
    return null;
  }
}

export function saveToken(store: KeyValueStore, token: StoredToken): void {
  store.setItem(KEY, JSON.stringify(token));
}

export function clearToken(store: KeyValueStore): void {
  store.removeItem(KEY);
}
