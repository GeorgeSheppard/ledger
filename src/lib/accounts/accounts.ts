import { RESERVED_TAB_PREFIX, type Account } from '../domain/types';

/** Account (sheet tab) helpers: name rules, lookup from the URL, and cycling through accounts. */

/** Characters Google Sheets does not allow in tab names. */
const FORBIDDEN_TAB_CHARS = /[[\]*?/\\:]/;

/** Why `name` cannot be used for an account tab, or null when it can. */
export function validateAccountName(
  accounts: readonly Account[],
  name: string,
  currentId?: number
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name';
  if (trimmed.startsWith(RESERVED_TAB_PREFIX))
    return `Names starting with "${RESERVED_TAB_PREFIX}" are reserved`;
  if (FORBIDDEN_TAB_CHARS.test(trimmed)) return 'Names cannot contain [ ] * ? / \\ or :';
  if (trimmed.length > 100) return 'Keep names under 100 characters';
  const clash = accounts.find(
    (a) => a.id !== currentId && a.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (clash) return `"${clash.name}" already exists`;
  return null;
}

/** The account a `:accountId` route parameter refers to, if any. */
export function findAccountByParam(
  accounts: readonly Account[],
  param: string | undefined
): Account | undefined {
  if (param === undefined || !/^\d+$/.test(param)) return undefined;
  const id = Number(param);
  return accounts.find((a) => a.id === id);
}

/** The account `delta` steps from `currentId`, wrapping around at either end. */
export function adjacentAccount(
  accounts: readonly Account[],
  currentId: number,
  delta: number
): Account | undefined {
  if (accounts.length === 0) return undefined;
  const index = accounts.findIndex((a) => a.id === currentId);
  if (index === -1) return accounts[0];
  const n = accounts.length;
  return accounts[(((index + delta) % n) + n) % n];
}

/** Accounts whose name contains the query, best matches (prefix) first. */
export function filterAccounts(accounts: readonly Account[], query: string): Account[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...accounts];
  const starts = accounts.filter((a) => a.name.toLowerCase().startsWith(q));
  const contains = accounts.filter(
    (a) => !a.name.toLowerCase().startsWith(q) && a.name.toLowerCase().includes(q)
  );
  return [...starts, ...contains];
}
