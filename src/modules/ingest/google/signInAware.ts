import type { LedgerRemote } from '../../../lib/store/remote';
import { SignInRequiredError } from './auth';

/**
 * Wraps a remote so that, if Google says the user must sign in again, `onSignInRequired` runs
 * (the session then returns to the landing page) before the error reaches the caller. Unsaved
 * edits stay in the browser and are saved after the user signs back in.
 */
export function signInAware(remote: LedgerRemote, onSignInRequired: () => void): LedgerRemote {
  const wrap =
    <A extends unknown[], R>(method: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await method.apply(remote, args);
      } catch (error) {
        if (error instanceof SignInRequiredError) onSignInRequired();
        throw error;
      }
    };
  return { load: wrap(remote.load), save: wrap(remote.save) };
}
