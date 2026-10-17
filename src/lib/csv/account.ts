import type { Account } from '../domain/types';

/**
 * The account a file most likely belongs to: the one whose name appears in the file name
 * (`current-account-march.csv` → `Current account`), preferring the longest match. Falls back to
 * the first account.
 */
export function guessAccount(fileName: string, accounts: readonly Account[]): Account | null {
  const simplify = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const file = ` ${simplify(fileName)} `;
  const matches = accounts
    .filter((a) => simplify(a.name) !== '' && file.includes(` ${simplify(a.name)} `))
    .sort((a, b) => simplify(b.name).length - simplify(a.name).length);
  return matches[0] ?? accounts[0] ?? null;
}
