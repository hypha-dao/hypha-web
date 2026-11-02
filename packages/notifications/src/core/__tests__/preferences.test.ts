import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}));
vi.mock('../../sdk/client', () => ({ sdkClient: sdk }));

import {
  enrolNotifications,
  getNotificationPreferences,
  saveNotificationPreferences,
  unenrolNotifications,
} from '../preferences';

const notFound = Object.assign(new Error('not found'), { code: 404 });

function user(
  tags: Record<string, string> = {},
  subscriptions: Record<string, unknown>[] = [],
) {
  return { properties: { tags }, subscriptions };
}

describe('notification preferences (server side)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-id');
    Object.values(sdk).forEach((fn) => fn.mockReset());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getNotificationPreferences', () => {
    it('treats a person without a OneSignal user as not enrolled, defaults on', async () => {
      sdk.getUser.mockRejectedValue(notFound);
      const prefs = await getNotificationPreferences('alice');
      expect(prefs.subscribed).toBe(false);
      expect(prefs.emailEnabled).toBe(true);
      expect(prefs.pushTagEnabled).toBe(true);
      expect(prefs.subscriptions.every((s) => s.value)).toBe(true);
      expect(sdk.createUser).not.toHaveBeenCalled();
    });

    it('reads tags: subscribed opt-in, disabled and legacy false switch off', async () => {
      sdk.getUser.mockResolvedValue(
        user({
          subscribed: 'true',
          email: 'disabled',
          push: 'false',
          sub_signals: 'disabled',
        }),
      );
      const prefs = await getNotificationPreferences('alice');
      expect(sdk.getUser).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
      );
      expect(prefs.subscribed).toBe(true);
      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.pushTagEnabled).toBe(false);
      expect(
        prefs.subscriptions.find((s) => s.name === 'sub_signals')?.value,
      ).toBe(false);
    });

    it('rethrows errors other than not-found', async () => {
      sdk.getUser.mockRejectedValue(
        Object.assign(new Error('boom'), { code: 500 }),
      );
      await expect(getNotificationPreferences('alice')).rejects.toThrow('boom');
    });

    it('throws when the app id is missing', async () => {
      vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '');
      await expect(getNotificationPreferences('alice')).rejects.toThrow(
        'ONESIGNAL_APP_ID environment variable is not set',
      );
    });
  });

  describe('enrolNotifications', () => {
    it('creates the user by external_id when absent, then writes subscribed + own-actions off', async () => {
      sdk.getUser.mockRejectedValue(notFound);
      sdk.createUser.mockResolvedValue(user());
      const prefs = await enrolNotifications('alice');
      expect(sdk.createUser).toHaveBeenCalledWith('app-id', {
        identity: { external_id: 'alice' },
        properties: { tags: {} },
      });
      expect(sdk.updateUser).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
        {
          properties: {
            tags: { subscribed: 'true', sub_ownActions: 'disabled' },
          },
        },
      );
      expect(prefs.subscribed).toBe(true);
    });

    it('never overwrites an own-actions choice the person already made', async () => {
      sdk.getUser.mockResolvedValue(user({ sub_ownActions: 'true' }));
      await enrolNotifications('alice');
      expect(sdk.createUser).not.toHaveBeenCalled();
      expect(sdk.updateUser.mock.calls[0][3]).toEqual({
        properties: { tags: { subscribed: 'true' } },
      });
    });

    it('falls back to the existing user when creation races with the SDK login', async () => {
      sdk.getUser
        .mockRejectedValueOnce(notFound)
        .mockResolvedValueOnce(user({ subscribed: 'false' }));
      sdk.createUser.mockRejectedValue(new Error('already exists'));
      await expect(enrolNotifications('alice')).resolves.toMatchObject({
        subscribed: true,
      });
    });
  });

  it('unenrolNotifications writes subscribed=false', async () => {
    sdk.getUser.mockResolvedValue(user({ subscribed: 'true' }));
    const prefs = await unenrolNotifications('alice');
    expect(sdk.updateUser.mock.calls[0][3]).toEqual({
      properties: { tags: { subscribed: 'false' } },
    });
    expect(prefs.subscribed).toBe(false);
  });

  describe('saveNotificationPreferences', () => {
    const subs = [
      { name: 'sub_signals' as const, value: false },
      { name: 'consent_mentions' as const, value: true },
    ];

    it('batches all tags into one update: off => disabled, on => removed', async () => {
      sdk.getUser.mockResolvedValue(user({ subscribed: 'true' }));
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: false,
        pushTagEnabled: true,
        subscriptions: subs,
      });
      expect(sdk.updateUser).toHaveBeenCalledTimes(1);
      expect(sdk.updateUser.mock.calls[0][3]).toEqual({
        properties: {
          tags: {
            email: 'disabled',
            push: '',
            sub_signals: 'disabled',
            consent_mentions: '',
          },
        },
      });
    });

    it('leaves the push tag alone when pushTagEnabled is omitted', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(
        Object.keys(sdk.updateUser.mock.calls[0][3].properties.tags),
      ).toEqual(['email']);
    });

    it('ignores tag names that are not preference groups', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [
          { name: 'subscribed' as never, value: false },
          { name: 'sub_signals', value: false },
        ],
      });
      const tags = sdk.updateUser.mock.calls[0][3].properties.tags;
      expect(tags.subscribed).toBeUndefined();
      expect(tags.sub_signals).toBe('disabled');
    });

    it('email on: creates an Email subscription for the address when none exists', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).toHaveBeenCalledWith(
        'app-id',
        'external_id',
        'alice',
        {
          subscription: {
            type: 'Email',
            token: 'a@example.com',
            enabled: true,
          },
        },
      );
    });

    it('email on: re-enables an unsubscribed subscription instead of duplicating it', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          {
            id: 'sub-1',
            type: 'Email',
            token: 'A@Example.com',
            enabled: false,
          },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(sdk.updateSubscription).toHaveBeenCalledWith('app-id', 'sub-1', {
        subscription: { enabled: true },
      });
    });

    it('email on with an already enabled subscription is a no-op for subscriptions', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          { id: 'sub-1', type: 'Email', token: 'a@example.com', enabled: true },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
      expect(sdk.updateSubscription).not.toHaveBeenCalled();
    });

    it('email off: deletes the matching subscription, leaves other types alone', async () => {
      sdk.getUser.mockResolvedValue(
        user({}, [
          { id: 'push-1', type: 'ChromePush', token: 'x', enabled: true },
          { id: 'sub-1', type: 'Email', token: 'a@example.com', enabled: true },
        ]),
      );
      await saveNotificationPreferences('alice', 'a@example.com', {
        emailEnabled: false,
        subscriptions: [],
      });
      expect(sdk.deleteSubscription).toHaveBeenCalledTimes(1);
      expect(sdk.deleteSubscription).toHaveBeenCalledWith('app-id', 'sub-1');
    });

    it('touches no email subscription when the person has no address', async () => {
      sdk.getUser.mockResolvedValue(user());
      await saveNotificationPreferences('alice', undefined, {
        emailEnabled: true,
        subscriptions: [],
      });
      expect(sdk.createSubscription).not.toHaveBeenCalled();
    });
  });
});
