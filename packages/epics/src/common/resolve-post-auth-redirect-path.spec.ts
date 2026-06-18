// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthReturnPath,
  consumeAuthReturnPath,
  isDhoSpaceContextPath,
  peekAuthReturnPath,
  resolvePostAuthRedirectPath,
  resolvePostAuthRedirectPathOrDefault,
  saveAuthReturnPath,
} from '@hypha-platform/authentication';

describe('auth-return-path', () => {
  beforeEach(() => {
    const session = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
      clear: () => session.clear(),
    });
    clearAuthReturnPath();
  });

  it('detects DHO space context paths', () => {
    expect(isDhoSpaceContextPath('/en/dho/hypha/agreements')).toBe(true);
    expect(isDhoSpaceContextPath('/en/network')).toBe(false);
  });

  it('stores and consumes a DHO return path', () => {
    saveAuthReturnPath('/en/dho/hypha/coherence');
    expect(peekAuthReturnPath()).toBe('/en/dho/hypha/coherence');
    expect(consumeAuthReturnPath()).toBe('/en/dho/hypha/coherence');
    expect(peekAuthReturnPath()).toBeNull();
  });

  it('ignores non-DHO paths', () => {
    saveAuthReturnPath('/en/dho/hypha/coherence');
    saveAuthReturnPath('/en/network');
    expect(peekAuthReturnPath()).toBeNull();
  });
});

describe('resolvePostAuthRedirectPath', () => {
  beforeEach(() => {
    const session = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
      clear: () => session.clear(),
    });
    clearAuthReturnPath();
  });

  it('normalizes stored space context paths to the active tab', () => {
    saveAuthReturnPath('/en/dho/hypha/coherence/signals/abc');

    expect(
      resolvePostAuthRedirectPath({
        pathname: '/en/profile/signup',
        lang: 'en',
        baseRedirectPath: '/my-spaces',
      }),
    ).toBe('/en/dho/hypha/coherence');
  });

  it('normalizes bare stored space paths to overview', () => {
    saveAuthReturnPath('/en/dho/hypha');

    expect(
      resolvePostAuthRedirectPath({
        pathname: '/en/profile/signup',
        lang: 'en',
        baseRedirectPath: '/my-spaces',
      }),
    ).toBe('/en/dho/hypha/overview');
  });

  it('falls back to the current DHO path when no stored return path exists', () => {
    expect(
      resolvePostAuthRedirectPathOrDefault({
        pathname: '/en/dho/hypha/agreements',
        lang: 'en',
        baseRedirectPath: '/my-spaces',
      }),
    ).toBe('/en/dho/hypha/agreements');
  });

  it('falls back to base redirect path outside space context', () => {
    expect(
      resolvePostAuthRedirectPathOrDefault({
        pathname: '/en/network',
        lang: 'en',
        baseRedirectPath: '/my-spaces',
      }),
    ).toBe('/my-spaces');
  });
});
