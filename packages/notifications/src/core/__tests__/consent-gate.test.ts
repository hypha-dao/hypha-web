import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('../../sdk', () => ({ sdkClient: { getUser } }));

import { gateRecipientChannels, resolveConsentedSlugs } from '../consent-gate';

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
    await expect(resolveConsentedSlugs(['alice'], [])).rejects.toThrow(
      'ONESIGNAL_APP_ID environment variable is not set',
    );
  });

  it('returns [] without calling OneSignal for an empty input', async () => {
    expect(await resolveConsentedSlugs([], ['subscribed'])).toEqual([]);
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

    const allowed = await resolveConsentedSlugs(
      ['alice', 'bob', 'carol'],
      ['subscribed', 'push'],
    );

    expect(allowed).toEqual(['alice']);
  });

  it('drops a slug whose OneSignal lookup rejects rather than failing the whole batch', async () => {
    getUser.mockImplementation((_appId, _by, slug) => {
      if (slug === 'alice')
        return userWithTags({ subscribed: 'true', push: 'true' });
      return Promise.reject(new Error('not found'));
    });

    const allowed = await resolveConsentedSlugs(
      ['alice', 'ghost'],
      ['subscribed', 'push'],
    );

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
        return userWithTags({
          subscribed: 'true',
          push: 'true',
          email: 'disabled',
        });
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
      [],
    );

    expect(allowed.get('push')).toEqual(new Set(['alice', 'bob']));
    expect(allowed.get('email')).toEqual(new Set(['alice']));
  });

  it('always allows in_app — no tag gate exists for it yet', async () => {
    const allowed = await gateRecipientChannels(
      [{ personSlug: 'alice' }, { personSlug: 'ghost' }],
      ['in_app'],
      [],
    );

    expect(allowed.get('in_app')).toEqual(new Set(['alice', 'ghost']));
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('consent semantics (#2549: enabled unless disabled)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-id');
    getUser.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['absent', undefined, true],
    ["'true'", 'true', true],
    ["'disabled'", 'disabled', false],
    ["legacy 'false'", 'false', false],
  ])('type tag %s -> allowed=%s', async (_label, value, expected) => {
    getUser.mockResolvedValue(
      userWithTags({
        subscribed: 'true',
        ...(value === undefined ? {} : { sub_signals: value }),
      }),
    );
    const allowed = await resolveConsentedSlugs(
      ['alice'],
      ['subscribed', 'sub_signals'],
    );
    expect(allowed).toEqual(expected ? ['alice'] : []);
  });

  it.each([
    ['absent', undefined, true],
    ["'disabled'", 'disabled', false],
    ["legacy 'false'", 'false', false],
  ])('channel tag %s -> allowed=%s', async (_label, value, expected) => {
    getUser.mockResolvedValue(
      userWithTags({
        subscribed: 'true',
        ...(value === undefined ? {} : { email: value, push: value }),
      }),
    );
    const allowed = await gateRecipientChannels(
      [{ personSlug: 'alice' }],
      ['push', 'email'],
      [],
    );
    expect(allowed.get('push')?.has('alice')).toBe(expected);
    expect(allowed.get('email')?.has('alice')).toBe(expected);
  });

  it('still requires subscribed === true for email and push', async () => {
    getUser.mockResolvedValue(userWithTags({}));
    const allowed = await gateRecipientChannels(
      [{ personSlug: 'alice' }],
      ['push', 'email'],
      [],
    );
    expect(allowed.get('push')?.size).toBe(0);
    expect(allowed.get('email')?.size).toBe(0);
  });
});
