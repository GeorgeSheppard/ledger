import { describe, expect, it, vi } from 'vitest';
import { memoryStore } from './rememberedSpreadsheet';
import { GOOGLE_SCOPE, GoogleAuth, SignInRequiredError } from './auth';
import type { GisOauth2, TokenResponse } from './googleGlobals';

function fakeOauth2(responses: (TokenResponse | { errorType: string })[], granted = true) {
  const oauth2: GisOauth2 & { requests: string[] } = {
    requests: [],
    initTokenClient: ({ callback, error_callback }) => ({
      requestAccessToken: (overrides) => {
        oauth2.requests.push(overrides?.prompt ?? '');
        const next = responses.shift();
        queueMicrotask(() => {
          if (next && 'errorType' in next) error_callback?.({ type: next.errorType });
          else callback(next ?? { error: 'none left' });
        });
      },
    }),
    hasGrantedAllScopes: () => granted,
    revoke: vi.fn(),
  };
  return oauth2;
}

describe('GoogleAuth', () => {
  it('signs in, stores the token for the tab, and reuses it until it nears expiry', async () => {
    let now = 0;
    const store = memoryStore();
    const oauth2 = fakeOauth2([
      { access_token: 'a', expires_in: 3600, scope: GOOGLE_SCOPE },
      { access_token: 'b', expires_in: 3600, scope: GOOGLE_SCOPE },
    ]);
    const auth = new GoogleAuth({
      clientId: 'c',
      loadOauth2: async () => oauth2,
      store,
      now: () => now,
    });
    expect(auth.isSignedIn).toBe(false);
    await auth.signIn();
    expect(auth.isSignedIn).toBe(true);
    expect(await auth.getAccessToken()).toBe('a');

    // A reload in the same tab picks the token back up.
    const reloaded = new GoogleAuth({
      clientId: 'c',
      loadOauth2: async () => oauth2,
      store,
      now: () => now,
    });
    expect(reloaded.isSignedIn).toBe(true);

    now = 3_600_000 - 30_000;
    expect(await auth.getAccessToken()).toBe('b');
    expect(oauth2.requests).toHaveLength(2);
  });

  it('shares one token request between concurrent callers', async () => {
    const oauth2 = fakeOauth2([{ access_token: 'a', expires_in: 3600 }]);
    const auth = new GoogleAuth({
      clientId: 'c',
      loadOauth2: async () => oauth2,
      store: memoryStore(),
    });
    const tokens = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect(tokens).toEqual(['a', 'a']);
    expect(oauth2.requests).toHaveLength(1);
  });

  it('reports a blocked popup and missing permission as sign-in required', async () => {
    const blocked = fakeOauth2([{ errorType: 'popup_failed_to_open' }]);
    const auth = new GoogleAuth({
      clientId: 'c',
      loadOauth2: async () => blocked,
      store: memoryStore(),
    });
    await expect(auth.signIn()).rejects.toThrow(/blocked/);

    const denied = fakeOauth2([{ access_token: 'a', expires_in: 3600 }], false);
    const auth2 = new GoogleAuth({
      clientId: 'c',
      loadOauth2: async () => denied,
      store: memoryStore(),
    });
    await expect(auth2.getAccessToken()).rejects.toBeInstanceOf(SignInRequiredError);
    expect(auth2.isSignedIn).toBe(false);
  });

  it('signs out by forgetting and revoking the token', async () => {
    const store = memoryStore();
    const oauth2 = fakeOauth2([{ access_token: 'a', expires_in: 3600 }]);
    const auth = new GoogleAuth({ clientId: 'c', loadOauth2: async () => oauth2, store });
    await auth.signIn();
    auth.signOut();
    expect(auth.isSignedIn).toBe(false);
    expect(store.getItem('ledger.googleToken')).toBeNull();
    await vi.waitFor(() => expect(oauth2.revoke).toHaveBeenCalledWith('a'));
  });
});
