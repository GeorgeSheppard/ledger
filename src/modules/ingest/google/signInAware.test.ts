import { describe, expect, it, vi } from 'vitest';
import { fixtureData } from '../../../lib/data/fixtures';
import { MemoryRemote } from '../../../lib/store/remote';
import { SignInRequiredError } from './auth';
import { signInAware } from './signInAware';

describe('signInAware', () => {
  it('passes calls through and reports when sign-in is required', async () => {
    const inner = new MemoryRemote(fixtureData());
    inner.save = async () => {
      throw new SignInRequiredError();
    };
    const onSignInRequired = vi.fn();
    const remote = signInAware(inner, onSignInRequired);
    const loaded = await remote.load();
    expect(loaded.data.accounts).toHaveLength(2);
    await expect(remote.save(loaded, loaded.data)).rejects.toBeInstanceOf(SignInRequiredError);
    expect(onSignInRequired).toHaveBeenCalledTimes(1);
  });

  it('does not report other errors', async () => {
    const inner = new MemoryRemote(fixtureData());
    inner.load = async () => {
      throw new Error('offline');
    };
    const onSignInRequired = vi.fn();
    await expect(signInAware(inner, onSignInRequired).load()).rejects.toThrow('offline');
    expect(onSignInRequired).not.toHaveBeenCalled();
  });
});
