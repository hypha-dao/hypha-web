import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('../sdk', () => ({ sdkClient: { getUser } }));

import { gateRecipientChannels, resolveConsentedSlugs } from './consent-gate';

function userWithTags(tags: Record<string, string>) {
  return { properties: { tags } };
}

describe('resolveConsentedSlugs', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-id');
    getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when the OneSignal app id is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '');
    await expect(resolveConsentedSlugs(['alice'], {})).rejects.toThrow(
      'ONESIGNAL_APP_ID environment variable is not set',
    );
  });

  it('returns [] without calling OneSignal for an empty input', async () => {
    expect(await resolveConsentedSlugs([], { subscribed: 'true' })).toEqual([]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('keeps only slugs whose OneSignal tags match every required tag', async () => {
    getUser.mockImplementation((_appId, _by, slug) => {
      if (slug === 'alice')
        return userWithTags({ subscribed: 'true', push: 'true' });
      if (slug === 'bob')
        return userWithTags({ subscribed: 'true', push: 'false' });
      return userWithTags({});
    });

    const allowed = await resolveConsentedSlugs(['alice', 'bob', 'carol'], {
      subscribed: 'true',
      push: 'true',
    });

    expect(allowed).toEqual(['alice']);
  });

  it('drops a slug whose OneSignal lookup rejects rather than failing the whole batch', async () => {
    getUser.mockImplementation((_appId, _by, slug) => {
      if (slug === 'alice')
        return userWithTags({ subscribed: 'true', push: 'true' });
      return Promise.reject(new Error('not found'));
    });

    const allowed = await resolveConsentedSlugs(['alice', 'ghost'], {
      subscribed: 'true',
      push: 'true',
    });

    expect(allowed).toEqual(['alice']);
  });
});

describe('gateRecipientChannels', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-id');
    getUser.mockReset();
    getUser.mockImplementation((_appId, _by, slug) => {
      if (slug === 'alice')
        return userWithTags({
          subscribed: 'true',
          push: 'true',
          email: 'true',
        });
      if (slug === 'bob')
        return userWithTags({ subscribed: 'true', push: 'true' });
      return userWithTags({});
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gates push and email independently per recipient', async () => {
    const allowed = await gateRecipientChannels(
      [{ personSlug: 'alice' }, { personSlug: 'bob' }],
      ['push', 'email'],
      {},
    );

    expect(allowed.get('push')).toEqual(new Set(['alice', 'bob']));
    expect(allowed.get('email')).toEqual(new Set(['alice']));
  });

  it('always allows in_app — no tag gate exists for it yet', async () => {
    const allowed = await gateRecipientChannels(
      [{ personSlug: 'alice' }, { personSlug: 'ghost' }],
      ['in_app'],
      {},
    );

    expect(allowed.get('in_app')).toEqual(new Set(['alice', 'ghost']));
    expect(getUser).not.toHaveBeenCalled();
  });
});
