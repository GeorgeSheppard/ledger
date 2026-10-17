import type { LedgerRepository } from '../data/repository';
import { SignInRequiredError } from './auth';

/**
 * Wraps a repository so that, if Google says the user must sign in again, `onSignInRequired` runs
 * (the session then returns to the landing page) before the error reaches the caller.
 */
export function signInAware(
  repository: LedgerRepository,
  onSignInRequired: () => void
): LedgerRepository {
  const wrap =
    <A extends unknown[], R>(method: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await method.apply(repository, args);
      } catch (error) {
        if (error instanceof SignInRequiredError) onSignInRequired();
        throw error;
      }
    };
  return {
    listAccounts: wrap(repository.listAccounts),
    createAccount: wrap(repository.createAccount),
    renameAccount: wrap(repository.renameAccount),
    listTransactions: wrap(repository.listTransactions),
    addTransactions: wrap(repository.addTransactions),
    updateTransaction: wrap(repository.updateTransaction),
    deleteTransaction: wrap(repository.deleteTransaction),
    listCategories: wrap(repository.listCategories),
    saveCategories: wrap(repository.saveCategories),
    renameCategory: wrap(repository.renameCategory),
  };
}
