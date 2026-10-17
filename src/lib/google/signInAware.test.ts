import { describe, expect, it, vi } from 'vitest';
import { fixtureData } from '../data/fixtures';
import { MemoryRepository } from '../data/memoryRepository';
import { SignInRequiredError } from './auth';
import { signInAware } from './signInAware';

describe('signInAware', () => {
  it('passes calls through and reports when sign-in is required', async () => {
    const inner = new MemoryRepository(fixtureData());
    inner.listCategories = async () => {
      throw new SignInRequiredError();
    };
    const onSignInRequired = vi.fn();
    const repo = signInAware(inner, onSignInRequired);
    expect(await repo.listAccounts()).toHaveLength(2);
    await expect(repo.listCategories()).rejects.toBeInstanceOf(SignInRequiredError);
    await expect(repo.deleteTransaction(1, 999)).rejects.toThrow('Unknown row');
    expect(onSignInRequired).toHaveBeenCalledTimes(1);
  });
});
