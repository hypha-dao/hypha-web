import { describe, expect, it } from 'vitest';
import { isInitialAuthorizeRequest } from './auth';

const at = (path: string) =>
  new Request(`http://auth.localhost:3000/api/auth${path}?x=1`, {
    method: path.includes('consent') ? 'POST' : 'GET',
  });

describe('isInitialAuthorizeRequest', () => {
  it('true for the app first, unsigned request to the authorize endpoint', () => {
    expect(
      isInitialAuthorizeRequest(at('/oauth2/authorize'), { scope: 'a' }),
    ).toBe(true);
  });

  it('false when the query carries the library signature (resume after sign-in)', () => {
    expect(
      isInitialAuthorizeRequest(at('/oauth2/authorize'), {
        scope: 'a',
        sig: 'abc',
        exp: '1',
      }),
    ).toBe(false);
  });

  it('false when the authorize endpoint is dispatched from the consent request', () => {
    expect(
      isInitialAuthorizeRequest(at('/oauth2/consent'), { scope: 'a' }),
    ).toBe(false);
    expect(
      isInitialAuthorizeRequest(at('/oauth2/continue'), { scope: 'a' }),
    ).toBe(false);
  });

  it('false without an HTTP request (internal call)', () => {
    expect(isInitialAuthorizeRequest(undefined, { scope: 'a' })).toBe(false);
  });
});
